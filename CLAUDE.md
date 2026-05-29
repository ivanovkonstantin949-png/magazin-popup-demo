# magazin-popup-demo — каталог новостроек для magazinnovostroek.su

## Что это

Vanilla JS embed (embed.js + data.json) для встраивания в Tilda popup
на сайт magazinnovostroek.su. Каталог 99 ЖК Ростова: фильтры по району,
комнатам, году сдачи, классу и ремонту; карточка + popup с галереей,
планировками и контактами агента.

Заказчик: Иван Карл Либкнехт (FL.ru, СД с агентом Никитой
@NikitaAleks66). Превью раздаётся через GitHub Pages
ivanovkonstantin949-png.github.io/magazin-popup-demo/

## Архитектура (стек)

- Frontend: чистый JS (IIFE, без бандлера), GitHub Pages
- Данные: статический data.json, 99 объектов, ~300 KB
- Картинки: CDN img.gid.house с шаблоном resize
  /rs:fill:WxH:0:0/plain/production/...jpg
- Интеграция: один `<script src="embed.js">` в Tilda popup HTML-блоке
- Стили: inline в JS, brand colors магазин-новостроек
  (#093244 / #f2f8fa / #379914 / Roboto)

## Структура

- embed.js — IIFE: DATA/CONTACTS/state, renderCard, openPopup, openLightbox
- data.json — items + contacts (телефон, WA, TG, MAX)
- index.html — обёртка для GitHub Pages превью с no-cache headers

## Ограничения

- Без бандлеров, без npm, без зависимостей
- Никакой бэкенд логики, только GET data.json + click handlers
- Должен работать в Tilda popup (изоляция CSS через `#mn-catalog` namespace)
- Mobile-first: 480px / 900px breakpoints
