/*
  product-details.js — попап «детально про страву» (фото, склад-у-фото, КБЖУ, кількість).
  Дані про склад/КБЖУ/алергени згенеровані для кожної страви (демо-дані, без бекенду —
  аналогічно решті сайту: чесний формат карток, але без реальної лабораторії).
  Фото інгредієнтів — з /assets/images/ingredients (надані користувачем 05.08); там, де фото
  немає, інгредієнт показується як кольоровий монограм-кружок (той самий прийом, що вже
  використовувався для «Салати/Закуски/Напої/Соуси» на menu.html до переїзду на окремі сторінки).
  Базові поля (назва, ціна, фото, вага/шт, рейтинг) читаються прямо з DOM картки,
  що по ній клікнули — не дублюються тут.
  Підключається глобально через build.js (як common.js), бо картки товарів є майже
  на кожній сторінці.
*/
(function () {
  'use strict';

  var DETAILS = {"hit-philadelphia":{"tags":["вершковий сир","лосось","огірок","рис","норі"],"kcal":205,"protein":7.2,"fat":7.2,"carbs":25.7,"allergens":"риба, молоко"},"hit-california":{"tags":["креветка","авокадо","огірок","ікра тобіко","рис","норі"],"kcal":207,"protein":8.3,"fat":6.4,"carbs":23.8,"allergens":"ракоподібні"},"hit-dragon":{"tags":["соус унагі","креветка","авокадо","кунжут","рис","норі"],"kcal":177,"protein":8.4,"fat":6.8,"carbs":24.7,"allergens":"риба, ракоподібні, кунжут"},"hit-philadelphia-cucumber":{"tags":["вершковий сир","лосось","огірок","рис","норі"],"kcal":154,"protein":5.8,"fat":6,"carbs":18,"allergens":"риба, молоко"},"hit-philadelphia-eel":{"tags":["лосось","вершковий сир","огірок","вугор унагі","соус унагі","кунжут","рис","норі"],"kcal":213,"protein":7.4,"fat":7.9,"carbs":26.9,"allergens":"риба, молоко, кунжут"},"hit-philadelphia-sesame":{"tags":["лосось","вершковий сир","авокадо","огірок","кунжут","рис","норі"],"kcal":181,"protein":6.6,"fat":8.4,"carbs":19.8,"allergens":"риба, молоко, кунжут"},"hit-spicy-tuna":{"tags":["тунець","гострий соус","рис","норі","кунжут","огірок"],"kcal":150,"protein":6.9,"fat":5.8,"carbs":19.2,"allergens":"риба"},"hit-vegan-avocado":{"tags":["вершковий сир","авокадо","огірок","кунжут","рис","норі"],"kcal":137,"protein":7.2,"fat":5.5,"carbs":21.6,"allergens":"молоко, кунжут"},"hit-losos-maxi":{"tags":["лосось","рис","норі"],"kcal":172,"protein":5.7,"fat":5.6,"carbs":17.5,"allergens":"риба"},"sety-panda":{"tags":["вершковий сир","огірок","кунжут","рис","норі"],"kcal":170,"protein":6.6,"fat":6.3,"carbs":21.6,"allergens":"без основних алергенів"},"sety-odesa-zapechena":{"tags":["рис","норі","сирна шапка","ікра тобіко"],"kcal":193,"protein":7.8,"fat":6.3,"carbs":22.3,"allergens":"молоко"},"sety-duet":{"tags":["лосось","вугор унагі","соус унагі","кунжут","вершковий сир","огірок","рис","норі"],"kcal":185,"protein":8.6,"fat":6.5,"carbs":21.8,"allergens":"без основних алергенів"},"sety-vegan-garden":{"tags":["авокадо","тофу","манго","кунжут","свіжі овочі","рис","норі"],"kcal":203,"protein":7.4,"fat":7.1,"carbs":23.3,"allergens":"без основних алергенів"},"sety-hostryi-mix":{"tags":["лосось","креветка","гострий соус","рис","норі"],"kcal":142,"protein":5.8,"fat":6.2,"carbs":21.1,"allergens":"риба, ракоподібні"},"sety-tunets-party":{"tags":["тунець","рис","норі"],"kcal":168,"protein":5.7,"fat":5,"carbs":20.6,"allergens":"риба"},"sety-dytiachyi":{"tags":["тамаго (омлет)","вершковий сир","огірок","курка","кляр темпура","рис","норі"],"kcal":195,"protein":8.5,"fat":6.8,"carbs":24.5,"allergens":"молоко"},"sety-korolivskyi":{"tags":["вершковий сир","соус унагі","ікра тобіко","рис","норі","тунець","лосось","креветка","вугор унагі"],"kcal":177,"protein":7.7,"fat":6.9,"carbs":26.4,"allergens":"риба, молоко"},"zapecheni-krevetka":{"tags":["соус унагі","креветка","рис","норі","сирна шапка","ікра тобіко","авокадо"],"kcal":161,"protein":6.3,"fat":8.2,"carbs":20.5,"allergens":"риба, ракоподібні, молоко"},"zapecheni-losos":{"tags":["вершковий сир","лосось","рис","норі","сирна шапка"],"kcal":178,"protein":7.2,"fat":8.5,"carbs":19.1,"allergens":"риба, молоко"},"zapecheni-kurka":{"tags":["курка","соус теріякі","рис","норі","сирна шапка","кунжут"],"kcal":178,"protein":7.5,"fat":6.9,"carbs":20.7,"allergens":"молоко"},"zapecheni-tunets":{"tags":["тунець","гострий соус","рис","норі","сирна шапка","кунжут"],"kcal":176,"protein":7.2,"fat":7.7,"carbs":19.8,"allergens":"риба"},"zapecheni-ovochevyi":{"tags":["авокадо","огірок","рис","норі","сирна шапка"],"kcal":206,"protein":8.4,"fat":9.7,"carbs":25.3,"allergens":"молоко"},"zapecheni-spicy-krab":{"tags":["крабові палички","гострий соус","спайсі-майонез","рис","норі","сирна шапка","ікра тобіко"],"kcal":215,"protein":9.5,"fat":10.5,"carbs":21.2,"allergens":"ракоподібні"},"zapecheni-vuhor":{"tags":["вугор унагі","соус унагі","кунжут","рис","норі","сирна шапка","огірок"],"kcal":187,"protein":7.7,"fat":6.7,"carbs":20.7,"allergens":"риба, кунжут"},"tempura-krevetka":{"tags":["соус унагі","креветка","рис","кляр темпура","огірок","спайсі-майонез"],"kcal":216,"protein":8.6,"fat":11.6,"carbs":26,"allergens":"риба, ракоподібні"},"tempura-losos":{"tags":["вершковий сир","лосось","соус унагі","рис","кляр темпура","кунжут"],"kcal":166,"protein":5.9,"fat":9.2,"carbs":19.3,"allergens":"риба, молоко"},"tempura-ovocheva":{"tags":["авокадо","огірок","батат","рис","кляр темпура","кунжут"],"kcal":170,"protein":7.1,"fat":10.3,"carbs":21.3,"allergens":"без основних алергенів"},"tempura-kurka":{"tags":["гострий соус","курка","рис","кляр темпура"],"kcal":166,"protein":6.2,"fat":9.8,"carbs":21,"allergens":"без основних алергенів"},"tempura-spicy-mix":{"tags":["лосось","креветка","гострий соус","рис","кляр темпура","спайсі-майонез"],"kcal":200,"protein":6.6,"fat":9.7,"carbs":21.3,"allergens":"риба, ракоподібні"},"tempura-krab":{"tags":["крабові палички","гострий соус","спайсі-майонез","рис","кляр темпура","ікра тобіко"],"kcal":179,"protein":6.8,"fat":10.6,"carbs":19.8,"allergens":"ракоподібні"},"nigiri-losos":{"tags":["лосось","рис"],"kcal":126,"protein":5.1,"fat":3.1,"carbs":19.1,"allergens":"риба"},"nigiri-tunets":{"tags":["рис","тунець"],"kcal":167,"protein":6.9,"fat":3.2,"carbs":23.5,"allergens":"риба"},"nigiri-gunkan-tobiko":{"tags":["ікра тобіко","рис","норі"],"kcal":115,"protein":5.7,"fat":3,"carbs":17.6,"allergens":"без основних алергенів"},"nigiri-vuhor":{"tags":["вугор унагі","соус унагі","кунжут","рис","норі"],"kcal":132,"protein":5.5,"fat":2.4,"carbs":16.1,"allergens":"риба, кунжут"},"nigiri-krevetka":{"tags":["креветка","рис"],"kcal":133,"protein":5,"fat":2.4,"carbs":17.4,"allergens":"ракоподібні"},"nigiri-tamago":{"tags":["тамаго (омлет)","рис","норі"],"kcal":140,"protein":7.2,"fat":3.9,"carbs":22.9,"allergens":"яйця"},"nigiri-gunkan-ikra":{"tags":["лосось","ікра лосося","рис","норі"],"kcal":150,"protein":7.6,"fat":3.4,"carbs":22.9,"allergens":"риба"},"nigiri-gunkan-spicy-tunets":{"tags":["тунець","гострий соус","рис","норі","кунжут"],"kcal":115,"protein":5.3,"fat":3.1,"carbs":16.5,"allergens":"риба"},"poke-losos":{"tags":["лосось","рис","свіжі овочі","огірок","авокадо","едамаме","кунжут"],"kcal":105,"protein":8.4,"fat":4.4,"carbs":9.8,"allergens":"риба"},"poke-tunets":{"tags":["тунець","манго","норі","рис","свіжі овочі"],"kcal":128,"protein":10.8,"fat":4.6,"carbs":13.3,"allergens":"риба, соя"},"poke-tofu":{"tags":["тофу","рис","свіжі овочі","авокадо","едамаме","кунжут"],"kcal":109,"protein":8.2,"fat":4.4,"carbs":11.8,"allergens":"соя"},"poke-krevetka":{"tags":["креветка","авокадо","манго","рис","свіжі овочі","огірок","кунжут"],"kcal":139,"protein":9.6,"fat":4.7,"carbs":13.7,"allergens":"ракоподібні"},"poke-hostryi-tunets":{"tags":["тунець","огірок","кунжут","гострий соус","рис","свіжі овочі"],"kcal":123,"protein":10.1,"fat":4.8,"carbs":14,"allergens":"риба, кунжут"},"poke-garden":{"tags":["авокадо","едамаме","огірок","кунжут","водорості чука","рис","свіжі овочі"],"kcal":122,"protein":9.6,"fat":5,"carbs":12.6,"allergens":"соя"},"supy-miso-klasychnyi":{"tags":["тофу","місо-паста","вакаме"],"kcal":37,"protein":3,"fat":1.7,"carbs":3.4,"allergens":"соя"},"supy-miso-losos":{"tags":["лосось","місо-паста","вакаме","тофу"],"kcal":37,"protein":3.1,"fat":1.8,"carbs":3.4,"allergens":"риба"},"supy-krevetky":{"tags":["креветка","місо-паста","вакаме"],"kcal":39,"protein":4,"fat":2.1,"carbs":3.7,"allergens":"ракоподібні"},"supy-miso-kurka":{"tags":["курка","тофу","місо-паста","вакаме"],"kcal":37,"protein":3.2,"fat":1.5,"carbs":2.8,"allergens":"соя"},"supy-miso-podviina":{"tags":["місо-паста","вакаме","тофу"],"kcal":34,"protein":3.6,"fat":1.8,"carbs":3,"allergens":"без основних алергенів"},"deserty-moti-asorti":{"tags":["рис","рисове тісто моті"],"kcal":209,"protein":2.9,"fat":7.4,"carbs":26.3,"allergens":"без основних алергенів"},"deserty-chizkeik-matcha":{"tags":["матча","вершковий сир","бісквітне тісто"],"kcal":270,"protein":3.9,"fat":10.6,"carbs":39.6,"allergens":"молоко"},"deserty-roll-bananovyi":{"tags":["шоколад","банан","рис","кляр темпура","цукор"],"kcal":196,"protein":3,"fat":7.3,"carbs":27.7,"allergens":"без основних алергенів"},"deserty-moti-mango":{"tags":["манго","рисове тісто моті"],"kcal":263,"protein":4,"fat":10.6,"carbs":36.4,"allergens":"без основних алергенів"},"deserty-chizkeik-yudzu-laim":{"tags":["лайм","юдзу","вершковий сир","бісквітне тісто"],"kcal":240,"protein":4.3,"fat":9.8,"carbs":32.8,"allergens":"молоко"},"deserty-taiiaki-shokolad":{"tags":["шоколад","бісквітне тісто"],"kcal":184,"protein":3.3,"fat":8.8,"carbs":26.6,"allergens":"глютен"},"deserty-fondan-kunzhut":{"tags":["кунжут","шоколад"],"kcal":224,"protein":3.5,"fat":8.3,"carbs":30.6,"allergens":"кунжут"},"salaty-chuka":{"tags":["кунжут","водорості чука","морська сіль","свіжі овочі"],"kcal":85,"protein":4.6,"fat":3.8,"carbs":7.8,"allergens":"кунжут"},"salaty-krab-ohirok":{"tags":["крабові палички","огірок","свіжі овочі","ікра тобіко","кунжут","спайсі-майонез"],"kcal":88,"protein":4.7,"fat":3.9,"carbs":7.8,"allergens":"ракоподібні"},"salaty-soba-ovochi":{"tags":["локшина соба","свіжі овочі","едамаме","кунжут"],"kcal":116,"protein":5.6,"fat":5,"carbs":10.7,"allergens":"глютен"},"salaty-edamame":{"tags":["едамаме","морська сіль","свіжі овочі","огірок"],"kcal":99,"protein":5.8,"fat":4.6,"carbs":9.4,"allergens":"соя"},"salaty-tunets-avokado":{"tags":["тунець","авокадо","кунжут","свіжі овочі"],"kcal":113,"protein":6.1,"fat":5.1,"carbs":9.8,"allergens":"риба, кунжут"},"zakusky-hyoza-kurka":{"tags":["курка","тісто","соєвий соус"],"kcal":209,"protein":10.3,"fat":11.1,"carbs":20.1,"allergens":"глютен"},"zakusky-kryltsia-teriiaki":{"tags":["курячі крильця","соус теріякі","кунжут"],"kcal":198,"protein":10.9,"fat":11.1,"carbs":17.7,"allergens":"без основних алергенів"},"zakusky-spicy-krab-krokety":{"tags":["крабові палички","гострий соус","крабова начинка"],"kcal":217,"protein":9.4,"fat":9.9,"carbs":19.2,"allergens":"ракоподібні, глютен"},"zakusky-edamame-sil":{"tags":["едамаме","морська сіль"],"kcal":183,"protein":7.2,"fat":8.7,"carbs":16,"allergens":"соя"},"zakusky-rysovi-kulky-losos":{"tags":["лосось","рис","кляр темпура","спайсі-майонез","кунжут"],"kcal":153,"protein":8.8,"fat":8.6,"carbs":14.8,"allergens":"риба"},"zakusky-onihiri":{"tags":["рис","норі","кунжут","соєвий соус"],"kcal":194,"protein":7,"fat":8.6,"carbs":14.8,"allergens":"без основних алергенів"},"napoi-chai-sencha":{"tags":["зелений чай"],"kcal":1,"protein":0,"fat":0,"carbs":0.3,"allergens":"без основних алергенів"},"napoi-chai-ulun":{"tags":["чай улун"],"kcal":1,"protein":0,"fat":0,"carbs":0.2,"allergens":"без основних алергенів"},"napoi-matcha-latte":{"tags":["матча"],"kcal":45,"protein":2.5,"fat":2,"carbs":4.5,"allergens":"молоко"},"napoi-voda-nehazovana":{"tags":["питна вода"],"kcal":0,"protein":0,"fat":0,"carbs":0,"allergens":"без основних алергенів"},"napoi-voda-hazovana":{"tags":["питна вода"],"kcal":0,"protein":0,"fat":0,"carbs":0,"allergens":"без основних алергенів"},"napoi-kompot":{"tags":["фрукти"],"kcal":45,"protein":0.1,"fat":0,"carbs":11,"allergens":"без основних алергенів"},"napoi-lymonad-yudzu-imbyr":{"tags":["юдзу","імбир"],"kcal":38,"protein":0.1,"fat":0,"carbs":9.2,"allergens":"без основних алергенів"},"napoi-cola-sprite":{"tags":["газована вода","цукор"],"kcal":42,"protein":0,"fat":0,"carbs":10.6,"allergens":"без основних алергенів"},"napoi-sik":{"tags":["фруктовий сік"],"kcal":46,"protein":0.3,"fat":0.1,"carbs":10.8,"allergens":"без основних алергенів"},"sousy-soievyi":{"tags":["соєвий соус"],"kcal":53,"protein":5.6,"fat":0,"carbs":5.6,"allergens":"соя"},"sousy-unahi":{"tags":["соус унагі"],"kcal":150,"protein":2,"fat":0.2,"carbs":35,"allergens":"риба"},"sousy-spicy-maionez":{"tags":["гострий соус","спайсі-майонез"],"kcal":420,"protein":1.5,"fat":44,"carbs":4,"allergens":"без основних алергенів"},"sousy-vasabi":{"tags":["васабі"],"kcal":90,"protein":2,"fat":0.6,"carbs":18,"allergens":"без основних алергенів"},"sousy-imbyr":{"tags":["імбир"],"kcal":65,"protein":0.2,"fat":0.1,"carbs":15,"allergens":"без основних алергенів"},"sousy-kunzhutnyi":{"tags":["кунжут"],"kcal":310,"protein":4,"fat":28,"carbs":10,"allergens":"кунжут"},"sousy-chili-manho":{"tags":["манго","гострий соус"],"kcal":140,"protein":0.5,"fat":0.2,"carbs":33,"allergens":"без основних алергенів"},"rolls-kalifornia-vuhor":{"tags":["вугор унагі","авокадо","огірок","ікра тобіко","рис","норі"],"kcal":195,"protein":6.8,"fat":7.5,"carbs":24,"allergens":"риба"},"rolls-kalifornia-spicy":{"tags":["крабові палички","авокадо","гострий соус","спайсі-майонез","рис","норі"],"kcal":210,"protein":6.5,"fat":8.5,"carbs":23,"allergens":"ракоподібні"},"rolls-zelenyi-drakon":{"tags":["креветка темпура","авокадо","огірок","рис","норі"],"kcal":180,"protein":7,"fat":7,"carbs":23,"allergens":"ракоподібні"},"rolls-chervonyi-drakon":{"tags":["креветка темпура","ікра тобіко","гострий соус","огірок","рис","норі"],"kcal":185,"protein":7.2,"fat":7.8,"carbs":22.5,"allergens":"риба, ракоподібні"},"nigiri-sashimi-losos":{"tags":["лосось"],"kcal":205,"protein":20,"fat":13,"carbs":0,"allergens":"риба"},"nigiri-sashimi-tunets":{"tags":["тунець"],"kcal":144,"protein":23,"fat":5,"carbs":0,"allergens":"риба"},"nigiri-hosomaki-losos":{"tags":["лосось","рис","норі"],"kcal":140,"protein":5,"fat":2.5,"carbs":22,"allergens":"риба"},"nigiri-hosomaki-ohirok":{"tags":["огірок","рис","норі"],"kcal":110,"protein":2.5,"fat":0.5,"carbs":23,"allergens":"без основних алергенів"},"nigiri-futomaki-ovochi":{"tags":["тамаго (омлет)","авокадо","огірок","морква","рис","норі"],"kcal":160,"protein":4.8,"fat":5.5,"carbs":24,"allergens":"яйця"}};
  var TAG_IMG = {"авокадо":"/assets/images/ingredients/japanese_ingredients_custom/авокадо.webp","банан":"/assets/images/ingredients/japanese_ingredients_custom/банан.webp","батат":"/assets/images/ingredients/japanese_ingredients_custom/батат.webp","бісквітне тісто":"/assets/images/ingredients/japanese_ingredients_custom/бісквітне тісто.webp","вакаме":"/assets/images/ingredients/japanese_ingredients_custom/вакаме.webp","васабі":"/assets/images/ingredients/japanese_ingredients_custom/васабі.webp","вершковий сир":"/assets/images/ingredients/japanese_ingredients_custom/вершковий сир.webp","водорості чука":"/assets/images/ingredients/japanese_ingredients_custom/водорості чука.webp","вугор унагі":"/assets/images/ingredients/ingredients_first_50_complete/Вугор.webp","газована вода":"/assets/images/ingredients/ingredients_0230_0239/Слабогазована мінеральна вода.webp","гострий соус":"/assets/images/ingredients/japanese_ingredients_custom/гострий соус.webp","едамаме":"/assets/images/ingredients/japanese_ingredients_custom/едамаме.webp","зелений чай":"/assets/images/ingredients/ingredients_0060_0069/Зелений чай.webp","кляр темпура":"/assets/images/ingredients/japanese_ingredients_custom/кляр темпура.webp","крабова начинка":"/assets/images/ingredients/japanese_ingredients_custom/крабова начинка.webp","крабові палички":"/assets/images/ingredients/ingredients_0090_0099/Крабові палички.webp","креветка":"/assets/images/ingredients/japanese_ingredients_custom/креветка.webp","кунжут":"/assets/images/ingredients/ingredients_0100_0109/Кунжут.webp","курка":"/assets/images/ingredients/ingredients_0100_0109/Курка.webp","курячі крильця":"/assets/images/ingredients/ingredients_0110_0119/Курячі крильця.webp","лайм":"/assets/images/ingredients/ingredients_0110_0119/Лайм.webp","локшина соба":"/assets/images/ingredients/japanese_ingredients_custom/локшина соба.webp","лосось":"/assets/images/ingredients/japanese_ingredients_custom/лосось.webp","манго":"/assets/images/ingredients/ingredients_0120_0129/Манго.webp","матча":"/assets/images/ingredients/japanese_ingredients_custom/матча.webp","морська сіль":"/assets/images/ingredients/japanese_ingredients_custom/морська сіль.webp","місо-паста":"/assets/images/ingredients/japanese_ingredients_custom/місо-паста.webp","норі":"/assets/images/ingredients/ingredients_0160_0169/Норі.webp","огірок":"/assets/images/ingredients/ingredients_0160_0169/Огірок.webp","питна вода":"/assets/images/ingredients/japanese_ingredients_custom/питна вода.webp","рис":"/assets/images/ingredients/ingredients_0200_0209/Рис.webp","рисове тісто моті":"/assets/images/ingredients/japanese_ingredients_custom/рисове тісто моті.webp","свіжі овочі":"/assets/images/ingredients/japanese_ingredients_custom/свіжі овочі.webp","сирна шапка":"/assets/images/ingredients/japanese_ingredients_custom/сирна шапка.webp","соус теріякі":"/assets/images/ingredients/ingredients_0250_0259/Соус Теріякі.webp","соус унагі":"/assets/images/ingredients/ingredients_0250_0259/Соус Унагі.webp","соєвий соус":"/assets/images/ingredients/ingredients_0240_0249/Соєвий соус.webp","спайсі-майонез":"/assets/images/ingredients/ingredients_0120_0129/Майонез.webp","тамаго (омлет)":"/assets/images/ingredients/japanese_ingredients_custom/тамаго (омлет).webp","тофу":"/assets/images/ingredients/japanese_ingredients_custom/тофу.webp","тунець":"/assets/images/ingredients/ingredients_0280_0289/Тунець.webp","тісто":"/assets/images/ingredients/ingredients_0120_0129/Листкове тісто.webp","фрукти":"/assets/images/ingredients/japanese_ingredients_custom/фрукти.webp","фруктовий сік":"/assets/images/ingredients/japanese_ingredients_custom/фруктовий сік.webp","цукор":"/assets/images/ingredients/ingredients_0300_0309/Цукор.webp","чай улун":"/assets/images/ingredients/japanese_ingredients_custom/чай улун.webp","шоколад":"/assets/images/ingredients/ingredients_0320_0329/Чорний шоколад.webp","юдзу":"/assets/images/ingredients/japanese_ingredients_custom/юдзу.webp","ікра лосося":"/assets/images/ingredients/ikura-macro.jpg","ікра тобіко":"/assets/images/ingredients/ingredients_0060_0069/Ікра Масаго.webp","імбир":"/assets/images/ingredients/ingredients_0130_0139/Маринований імбир.webp"};
  var MONO_COLORS = [
    ['rgba(140,190,120,.16)', '#A9CE8E'],
    ['rgba(245,132,53,.16)', '#F0A05C'],
    ['rgba(120,170,220,.16)', '#8FB6E8'],
    ['rgba(217,80,63,.16)', '#E98973'],
    ['rgba(179,157,232,.16)', '#B39DE8']
  ];

  function monoColorFor(tag) {
    var h = 0;
    for (var i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
    return MONO_COLORS[h % MONO_COLORS.length];
  }

  function formatUAH(n) {
    return Math.round(n).toLocaleString('uk-UA') + ' ₴';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var popup = document.getElementById('productPopup');
    if (!popup) return;

    var imgEl = document.getElementById('productPopupImg');
    var badgesEl = document.getElementById('productPopupBadges');
    var metaEl = document.getElementById('productPopupMeta');
    var titleEl = document.getElementById('productPopupTitle');
    var descEl = document.getElementById('productPopupDesc');
    var tagsEl = document.getElementById('productPopupTags');
    var nutritionEl = document.getElementById('productPopupNutrition');
    var noteEl = document.getElementById('productPopupNote');
    var qtyEl = document.getElementById('productPopupQty');
    var totalEl = document.getElementById('productPopupTotal');
    var addBtn = document.getElementById('productPopupAdd');

    var current = null; // { id, name, price, img }
    var qty = 1;

    function renderTotal() {
      qtyEl.textContent = String(qty);
      if (current) totalEl.textContent = formatUAH(current.price * qty);
    }

    function renderIngredientChip(tag) {
      var photo = TAG_IMG[tag];
      var label = '<span class="ingredient-chip__label">' + escapeHtml(tag) + '</span>';
      if (photo) {
        return '<div class="ingredient-chip"><span class="ingredient-chip__thumb"><img src="' + photo + '" alt="' + escapeHtml(tag) + '" width="56" height="56" loading="lazy"></span>' + label + '</div>';
      }
      var mono = monoColorFor(tag);
      var letters = tag.replace(/[«»()]/g, '').trim().slice(0, 2).toUpperCase();
      return '<div class="ingredient-chip ingredient-chip--mono"><span class="ingredient-chip__thumb" style="background:' + mono[0] + ';color:' + mono[1] + '">' + letters + '</span>' + label + '</div>';
    }

    function openForCard(card) {
      var addToCart = card.querySelector('.add-to-cart-btn');
      if (!addToCart) return;

      var id = addToCart.getAttribute('data-id');
      var name = addToCart.getAttribute('data-name');
      var price = Number(addToCart.getAttribute('data-price')) || 0;
      var img = addToCart.getAttribute('data-img');
      var extra = DETAILS[id] || { tags: [], kcal: null, protein: null, fat: null, carbs: null, allergens: '' };

      current = { id: id, name: name, price: price, img: img };
      qty = 1;

      imgEl.src = img;
      imgEl.alt = name;

      var badges = card.querySelector('.product-card__badges');
      badgesEl.innerHTML = badges ? badges.innerHTML : '';

      var meta = card.querySelector('.product-card__meta');
      metaEl.innerHTML = meta ? meta.innerHTML : '';

      titleEl.textContent = name;

      var desc = card.querySelector('.product-card__desc');
      descEl.textContent = desc ? desc.textContent : '';

      tagsEl.innerHTML = extra.tags.map(renderIngredientChip).join('');

      if (extra.kcal !== null) {
        nutritionEl.hidden = false;
        nutritionEl.innerHTML = [
          ['' + extra.kcal, 'ккал'],
          [String(extra.protein).replace('.', ',') , 'білки'],
          [String(extra.fat).replace('.', ','), 'жири'],
          [String(extra.carbs).replace('.', ','), 'вугл.']
        ].map(function (pair) {
          return '<div class="product-popup__nutrition-item"><div class="product-popup__nutrition-value">' + pair[0] + '</div><div class="product-popup__nutrition-label">' + pair[1] + '</div></div>';
        }).join('');
        noteEl.textContent = 'Харчова цінність на 100 г. Алергени: ' + (extra.allergens || 'уточнюйте у оператора') + '.';
        noteEl.hidden = false;
      } else {
        nutritionEl.hidden = true;
        noteEl.hidden = true;
      }

      renderTotal();
      window.PandaDrawer.open(popup);
    }

    document.addEventListener('click', function (e) {
      var card = e.target.closest('.product-card');
      if (!card) return;
      if (e.target.closest('.add-to-cart-btn')) return; // швидка дія лишається швидкою
      openForCard(card);
    });

    document.querySelector('[data-popup-qty-minus]').addEventListener('click', function () {
      if (qty > 1) { qty--; renderTotal(); }
    });
    document.querySelector('[data-popup-qty-plus]').addEventListener('click', function () {
      qty++; renderTotal();
    });

    addBtn.addEventListener('click', function () {
      if (!current) return;
      window.PandaCart.add({ id: current.id, name: current.name, price: current.price, img: current.img }, qty);
      addBtn.textContent = 'Додано ✓';
      setTimeout(function () {
        addBtn.innerHTML = 'Додати · <span id="productPopupTotal">' + formatUAH(current.price * qty) + '</span>';
        totalEl = document.getElementById('productPopupTotal');
      }, 1100);
    });
  });
})();
