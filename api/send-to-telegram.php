<?php
/**
 * send-to-telegram.php — єдина точка прийому всіх форм сайту: замовлення
 * з чекауту (/checkout.html), заявка на вакансію (/careers.html), звернення
 * з контактів (/contacts.html), питання шефу (/blog.html). Приймає POST
 * (форми шлють application/x-www-form-urlencoded або multipart/form-data —
 * PHP парсить обидва однаково в $_POST), формує текст і надсилає через
 * Telegram Bot API (sendMessage). Токен/chat_id — у telegram-config.php
 * поруч (не веб-доступний як текст, дивись коментар там).
 *
 * Відповідь завжди JSON: { "ok": true } або { "ok": false, "error": "..." }.
 * Фронтенд (forms.js/checkout.js) читає це поле, щоб показати чесний
 * успіх/помилку користувачу — нічого тут не імітується.
 */

header('Content-Type: application/json; charset=utf-8');

// Не показуємо текст PHP-помилок назовні (там шляхи сервера) — фронтенду
// достатньо JSON; самі помилки все одно потрапляють у error-лог хостингу.
ini_set('display_errors', '0');

function respond($ok, $extra = []) {
    http_response_code($ok ? 200 : 400);
    echo json_encode(array_merge(['ok' => $ok], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, ['error' => 'method_not_allowed']);
}

// ---------- Honeypot: приховане поле "company" на всіх формах сайту,
// його заповнюють лише боти-автозаповнювачі. Тихо відповідаємо "успіхом",
// щоб бот не зрозумів, що його впіймали, і не пробував обходити перевірку.
if (!empty($_POST['company'])) {
    respond(true);
}

// ---------- Origin: якщо браузер надіслав заголовок Origin, він мусить
// збігатися з нашим доменом — це відсікає спам-POST, який чужий сайт
// відправляє з браузерів своїх відвідувачів. Запити без Origin (curl,
// старі браузери) пропускаємо далі — їх стримує rate limit нижче.
$allowedHosts = ['pandasushi.od.ua', 'www.pandasushi.od.ua', 'localhost', '127.0.0.1'];
$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '') {
    $originHost = strtolower((string) parse_url($origin, PHP_URL_HOST));
    if ($originHost !== '' && !in_array($originHost, $allowedHosts, true)) {
        respond(false, ['error' => 'forbidden_origin']);
    }
}

// ---------- Rate limit: не більше 8 відправок за 10 хвилин з однієї
// IP-адреси. Лічильник — файл у системному tmp, без БД: у файлі лежать
// timestamp-и останніх відправок через кому, старі відсіюються.
$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
if ($ip !== '') {
    $rlFile = sys_get_temp_dir() . '/ps-forms-' . sha1($ip);
    $now = time();
    $stamps = [];
    if (is_file($rlFile)) {
        $stamps = array_filter(
            array_map('intval', explode(',', (string) @file_get_contents($rlFile))),
            function ($t) use ($now) { return $t > $now - 600; }
        );
    }
    if (count($stamps) >= 8) {
        respond(false, ['error' => 'too_many_requests']);
    }
    $stamps[] = $now;
    @file_put_contents($rlFile, implode(',', $stamps), LOCK_EX);
}

// ---------- Глобальний ліміт довжини полів: жодному законному полю не
// потрібно більше — це захист від мегабайтних POST-ів, які інакше пішли б
// у текст повідомлення. items_json більший, бо містить весь кошик.
foreach ($_POST as $k => $v) {
    if (is_string($v)) {
        $_POST[$k] = mb_substr($v, 0, $k === 'items_json' ? 20000 : 1500);
    }
}

$config = require __DIR__ . '/telegram-config.php';
$botToken = trim((string) ($config['bot_token'] ?? ''));
$chatId   = trim((string) ($config['chat_id'] ?? ''));

if ($botToken === '' || $chatId === '' || strpos($botToken, 'ВСТАВТЕ') !== false || strpos($chatId, 'ВСТАВТЕ') !== false) {
    error_log('send-to-telegram.php: telegram-config.php не заповнено (bot_token/chat_id — все ще плейсхолдери)');
    respond(false, ['error' => 'not_configured']);
}

// ---------- Хелпери ----------
function h($v) {
    return htmlspecialchars(trim((string) $v), ENT_QUOTES, 'UTF-8');
}
// "Мітка: значення" рядком, з екрануванням; порожнє значення — рядок пропускається.
function line($label, $value) {
    $value = trim((string) $value);
    return $value === '' ? '' : ('<b>' . h($label) . ':</b> ' . h($value) . "\n");
}
function clamp($str, $max = 1200) {
    $str = trim((string) $str);
    return mb_strlen($str) > $max ? (mb_substr($str, 0, $max) . '…') : $str;
}
function money($n) {
    return number_format((float) $n, 0, ',', ' ') . ' ₴';
}

$type = $_POST['_type'] ?? '';
$text = '';

switch ($type) {

    case 'order': {
        $items = json_decode($_POST['items_json'] ?? '[]', true);
        if (!is_array($items) || !count($items)) respond(false, ['error' => 'empty_cart']);
        // Розумна верхня межа позицій: більше в меню просто немає, а
        // штучно роздутий кошик перевищив би ліміт повідомлення Telegram.
        $items = array_slice($items, 0, 50);

        $phone = trim($_POST['phone'] ?? '');
        if ($phone === '') respond(false, ['error' => 'missing_phone']);

        $fulfillment = ($_POST['fulfillment'] ?? '') === 'pickup' ? 'pickup' : 'delivery';
        $orderNum = preg_replace('/[^0-9]/', '', $_POST['order_num'] ?? '');

        $text = '🛒 <b>Нове замовлення' . ($orderNum !== '' ? " №$orderNum" : '') . "</b>\n\n";
        foreach ($items as $it) {
            $name = h(mb_substr((string) ($it['name'] ?? '?'), 0, 120));
            $qty = max(1, (int) ($it['qty'] ?? 1));
            $price = (float) ($it['price'] ?? 0);
            $text .= "• $name × $qty — " . money($price * $qty) . "\n";
        }
        $text .= "\n";
        $text .= line('Товари', money($_POST['cart_total'] ?? 0));
        $discount = (float) ($_POST['discount'] ?? 0);
        if ($discount > 0) $text .= line('Знижка (самовивіз −10%)', '−' . money($discount));
        $deliveryFee = (float) ($_POST['delivery_fee'] ?? 0);
        $text .= line('Доставка', $fulfillment === 'pickup' ? 'Самовивіз' : ($deliveryFee > 0 ? money($deliveryFee) : 'Безкоштовно'));
        $text .= '<b>До сплати: ' . money($_POST['total'] ?? 0) . "</b>\n\n";

        $text .= line('Отримання', $fulfillment === 'pickup' ? "Самовивіз (вул. Грецька, 12)" : 'Доставка');
        if ($fulfillment === 'delivery') {
            $addrParts = array_filter([
                !empty($_POST['apt']) ? 'кв. ' . $_POST['apt'] : '',
                !empty($_POST['entrance']) ? "під'їзд " . $_POST['entrance'] : '',
                !empty($_POST['floor']) ? 'поверх ' . $_POST['floor'] : '',
                !empty($_POST['intercom']) ? 'домофон ' . $_POST['intercom'] : '',
            ]);
            $addr = trim($_POST['street'] ?? '') . ($addrParts ? ' (' . implode(', ', $addrParts) . ')' : '');
            $text .= line('Адреса', $addr);
            $text .= line("Коментар кур'єру", clamp($_POST['comment'] ?? ''));
        }
        $timeMode = $_POST['timeMode'] ?? 'asap';
        $text .= line('Коли', $timeMode === 'scheduled'
            ? trim('До ' . ($_POST['date'] ?? '') . ' ' . ($_POST['time'] ?? ''))
            : 'Якнайшвидше');
        $persons = (int) ($_POST['persons'] ?? 0);
        if ($persons > 0) $text .= line('Прибори', $persons . ($persons >= 6 ? '+' : '') . ' персони');
        $paymentVal = $_POST['payment'] ?? 'cash';
        $paymentText = $paymentVal === 'card' ? "Карткою кур'єру" : 'Готівкою';
        if ($paymentVal !== 'card' && !empty($_POST['changeFrom'])) {
            $paymentText .= ', решта з ' . money($_POST['changeFrom']);
        }
        $text .= line('Оплата', $paymentText);
        $text .= line("Ім'я", $_POST['name'] ?? '');
        $text .= line('Телефон', $phone);
        break;
    }

    case 'careers': {
        $name = trim($_POST['name'] ?? '');
        $phone = trim($_POST['phone'] ?? '');
        if ($name === '' || $phone === '') respond(false, ['error' => 'missing_fields']);

        $text = "👤 <b>Заявка на вакансію</b>\n\n";
        $text .= line('Вакансія', $_POST['role'] ?? '');
        $text .= line("Ім'я", $name);
        $text .= line('Телефон', $phone);
        $text .= line('Коментар', clamp($_POST['note'] ?? ''));
        break;
    }

    case 'contacts': {
        $name = trim($_POST['name'] ?? '');
        $contact = trim($_POST['contact'] ?? '');
        $message = trim($_POST['message'] ?? '');
        if ($name === '' || $contact === '' || $message === '') respond(false, ['error' => 'missing_fields']);

        $text = "✉️ <b>Звернення з сайту</b>\n\n";
        $text .= line('Тема', $_POST['topic'] ?? '');
        $text .= line("Ім'я", $name);
        $text .= line('Контакт', $contact);
        $text .= line('Повідомлення', clamp($message));
        break;
    }

    case 'ask-chef': {
        $email = trim($_POST['email'] ?? '');
        $question = trim($_POST['question'] ?? '');
        if ($email === '' || $question === '') respond(false, ['error' => 'missing_fields']);

        $text = "🍣 <b>Питання шефу</b>\n\n";
        $text .= line('Email', $email);
        $text .= line('Питання', clamp($question));
        break;
    }

    default:
        respond(false, ['error' => 'unknown_type']);
}

// ---------- Відправка через Telegram Bot API ----------
// Ліміт sendMessage — 4096 символів: обрізаємо з запасом, щоб надто довге
// звернення не завалило відправку цілком.
$text = mb_substr($text, 0, 4000);
$apiUrl = 'https://api.telegram.org/bot' . rawurlencode($botToken) . '/sendMessage';
$payload = [
    'chat_id' => $chatId,
    'text' => $text,
    'parse_mode' => 'HTML',
    'disable_web_page_preview' => 'true',
];

$response = false;
$curlError = '';

if (function_exists('curl_init')) {
    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $response = curl_exec($ch);
    if ($response === false) $curlError = curl_error($ch);
    curl_close($ch);
} else {
    // Фолбек, якщо на хостингу вимкнене розширення curl.
    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
        'content' => http_build_query($payload),
        'timeout' => 10,
        'ignore_errors' => true,
    ]]);
    $response = @file_get_contents($apiUrl, false, $context);
}

$result = $response !== false ? json_decode($response, true) : null;

if (!is_array($result) || empty($result['ok'])) {
    error_log('send-to-telegram.php: Telegram API failed — ' . $curlError . ' | raw: ' . substr((string) $response, 0, 300));
    respond(false, ['error' => 'telegram_api_failed']);
}

respond(true);
