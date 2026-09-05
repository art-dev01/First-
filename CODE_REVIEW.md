# Ревью проекта Kelvin Portfolio

## Результат ревью

**Статус MR: нужны исправления перед merge.**

Основа проекта есть, но необходимо поправить структуру HTML, работу ссылок, подключение шрифта и организацию CSS. Адаптивность в этом ревью пока не рассматривается — её можно сделать отдельным следующим MR.

## Что нужно исправить

### 1. Использовать Flexbox и Grid вместо ручного позиционирования

В проекте многие элементы размещаются через `position: absolute` и большие ручные отступы `margin-left` и `margin-top`. Для построения основной сетки страницы лучше использовать `display: flex` и `display: grid`.

Простое правило для выбора:

- **Flexbox** используется, когда элементы нужно расположить в одном направлении — в строку или колонку;
- **Grid** используется, когда нужно построить сетку из строк и колонок.

Где использовать Flexbox в этом проекте:

- логотип и навигация в шапке;
- текст и фотография на первом экране;
- список иконок социальных сетей;
- вертикальное расположение содержимого footer.

Пример шапки:

```css
.header__container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: min(100% - 48px, 1120px);
  margin-inline: auto;
}

.navigation__list {
  display: flex;
  align-items: center;
  gap: 48px;
  padding: 0;
  list-style: none;
}
```

После этого для логотипа и навигации не нужны `position: absolute` и `margin-left`.

Пример первого экрана:

```css
.hero__container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 40px;
  width: min(100% - 48px, 1120px);
  margin-inline: auto;
}

.hero__content {
  max-width: 480px;
}

.hero__image {
  display: block;
  width: 494px;
  height: auto;
}
```

Где использовать Grid в этом проекте:

- три карточки услуг;
- карточки портфолио, если позже потребуется несколько работ в одной строке.

Пример услуг:

```css
.services__list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 70px;
  padding: 0;
  list-style: none;
}
```

Пример портфолио:

```css
.portfolio__list {
  display: grid;
  gap: 80px;
}
```

Сейчас работы портфолио идут одна под другой, поэтому достаточно Grid с одной колонкой. Если макет позже изменится, можно будет добавить `grid-template-columns`.

Пример социальных сетей:

```css
.socials {
  display: flex;
  justify-content: center;
  gap: 32px;
  padding: 0;
  list-style: none;
}
```

Важно: Flexbox и Grid используются для расположения блоков, а `position: absolute` — только для небольших декоративных элементов, которые действительно должны находиться поверх другого элемента. Например, абсолютное позиционирование можно оставить для жёлтой точки рядом с логотипом, если её неудобно сделать через псевдоэлемент.

Почему это важно: Flexbox и Grid сохраняют нормальный поток документа. При изменении текста или добавлении новой карточки соседние блоки автоматически сдвинутся и не будут накладываться друг на друга.

### 2. Использовать БЭМ для названий классов

Сейчас названия классов описывают отдельные картинки или внешний вид элементов: `.woman`, `.rebook`, `.woman-disc`, `.button-color`. По таким названиям сложно понять, к какому компоненту относится элемент и можно ли использовать его повторно.

Для проекта лучше использовать методологию БЭМ:

- **блок** — самостоятельный компонент: `.portfolio-card`;
- **элемент** — часть блока: `.portfolio-card__image`;
- **модификатор** — вариант блока или элемента: `.portfolio-card--featured`.

Название элемента отделяется двумя подчёркиваниями `__`, а модификатор — двумя дефисами `--`.

Пример HTML:

```html
<article class="portfolio-card portfolio-card--featured">
  <img
    class="portfolio-card__image"
    src="src/img/woman.webp"
    alt="Главная страница интернет-магазина одежды"
  >

  <h3 class="portfolio-card__title">
    <a class="portfolio-card__link" href="/projects/fashion-store.html">
      Online fashion store — Homepage
    </a>
  </h3>
</article>
```

Пример CSS:

```css
.portfolio-card {
  text-align: center;
}

.portfolio-card__image {
  display: block;
  width: 100%;
}

.portfolio-card__title {
  margin-top: 40px;
}

.portfolio-card__link {
  color: #000000;
  text-decoration: underline;
}

.portfolio-card--featured {
  grid-column: span 2;
}
```

Не нужно создавать отдельные классы `.woman`, `.reebok` и `.braun`, если все карточки имеют одинаковое устройство. Для них достаточно общего блока `.portfolio-card`.

Почему это важно: БЭМ делает классы понятными, уменьшает повторение CSS и помогает безопасно изменять один компонент, не затрагивая остальные части страницы.

### 3. Привести в порядок структуру HTML

Сейчас используется нестандартный тег `<content>`, а секция перед портфолио не закрыта. Кроме того, часть основного содержимого находится за пределами `<main>`.

Что сделать:

- заменить `<content>` на обычный `<section>`;
- закрыть все открытые `<section>`;
- поместить услуги и портфолио внутрь `<main>`;
- оставить `<footer>` после закрывающего `</main>`;
- навигацию желательно разместить внутри `<header>`.

Почему это важно: браузер пытается самостоятельно исправить неправильную разметку. Из-за этого реальная структура страницы может отличаться от написанного HTML, а стилизацию и поддержку проекта становится сложнее выполнять.

Пример общей структуры:

```html
<body>
  <header class="header">
    <a class="logo" href="#home">Kelvin</a>

    <nav class="navigation" aria-label="Основная навигация">
      <!-- Ссылки -->
    </nav>
  </header>

  <main>
    <section id="home" class="hero">
      <!-- Первый экран -->
    </section>

    <section id="services" class="services">
      <!-- Услуги -->
    </section>

    <section id="portfolio" class="portfolio">
      <!-- Портфолио -->
    </section>
  </main>

  <footer id="contacts" class="footer">
    <!-- Контакты -->
  </footer>
</body>
```

### 4. Сделать навигацию рабочей

Сейчас все ссылки используют `href="#"`. При нажатии пользователь не переходит к нужному разделу.

Нужно связать ссылки с `id` секций:

```html
<a href="#home">Home</a>
<a href="#portfolio">Works</a>
<a href="#services">Services</a>
<a href="#about">About</a>
<a href="#contacts">Contact</a>
```

Пример секции:

```html
<section id="portfolio" class="portfolio">
```

Если раздела `About` пока нет, нужно либо добавить его, либо временно убрать ссылку.

### 5. Подключить шрифт Poppins

В CSS указан `font-family: 'Poppins'`, но сам шрифт в проекте не подключён. Если Poppins не установлен на компьютере пользователя, браузер покажет другой шрифт.

Для учебного проекта можно подключить Google Fonts внутри `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link
  href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
  rel="stylesheet"
>
```

### 6. Убрать построение страницы через `position: absolute`

Сейчас многие элементы размещаются через `position: absolute` и большие ручные отступы вроде `margin-left: 345px`. Сам `<main>` тоже удалён из обычного потока страницы, а следующая секция вручную сдвинута через `margin-top`.

Почему это плохо: при изменении текста, шрифта или количества элементов блоки могут наложиться друг на друга или между ними появится лишнее пустое место.

Вместо ручных координат нужно использовать:

- общий контейнер;
- `display: flex` для шапки и первого экрана;
- `display: grid` для карточек услуг;
- `padding`, `margin` и `gap` для расстояний.

Пример контейнера:

```css
.container {
  width: min(100% - 48px, 1120px);
  margin-inline: auto;
}
```

Пример расположения первого экрана:

```css
.hero__container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 40px;
}
```

### 7. Переделать услуги в отдельные карточки

Сейчас сначала расположены три изображения, затем отдельно три заголовка и отдельно три описания. Связь между ними существует только визуально.

Каждая услуга должна быть отдельным законченным элементом:

```html
<ul class="services__list">
  <li class="service-card">
    <img
      class="service-card__icon"
      src="src/icons/graphic-1.svg"
      alt=""
    >

    <h3 class="service-card__title">UI/UX Design</h3>

    <p class="service-card__description">
      Our design is translated into comprehensive digital environments.
    </p>
  </li>
</ul>
```

Так изображение, название и описание одной услуги всегда будут находиться вместе.

### 8. Использовать настоящие заголовки

Сейчас названия `Portfolio` и `Contacts` сделаны через `<div>`. Их нужно заменить на заголовки:

```html
<h2 class="portfolio__title">Portfolio</h2>
<h2 class="footer__title">Contacts</h2>
```

Названия услуг можно сделать заголовками третьего уровня — `<h3>`.

Правильная примерная иерархия:

```text
h1 — Kelvin Kramer
  h2 — Services
    h3 — UI/UX Design
    h3 — Development
    h3 — Software Testing
  h2 — Portfolio
  h2 — Contacts
```

Почему это важно: заголовки формируют понятную структуру страницы для разработчиков, поисковых систем и скринридеров.

### 9. Сделать работы портфолио ссылками

Подписи работ подчёркнуты и выглядят как ссылки, но сейчас это обычные `<div>`.

Если работу можно открыть, нужно использовать `<a>`:

```html
<article class="portfolio-card">
  <img
    class="portfolio-card__image"
    src="src/img/woman.webp"
    alt="Главная страница интернет-магазина одежды"
    loading="lazy"
  >

  <h3 class="portfolio-card__title">
    <a href="/projects/fashion-store.html">
      Online fashion store — Homepage
    </a>
  </h3>
</article>
```

Если страницы проекта ещё нет, подчёркивание лучше временно убрать, чтобы элемент не выглядел кликабельным.

### 10. Исправить кнопку Send message

Сейчас кнопка является ссылкой с `href="#"`, а фон сделан отдельной SVG-картинкой. Действие не работает, а кликабельная область может не совпадать с видимой кнопкой.

Пример ссылки для отправки письма:

```html
<a class="contact-button" href="mailto:kelvin@example.com">
  Send message
</a>
```

Фон и форму кнопки лучше сделать через CSS:

```css
.contact-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding-inline: 28px;
  border-radius: 24px;
  color: #ffffff;
  background-color: #000000;
}
```

После этого картинка `chip bg.svg` больше не потребуется.

### 11. Сделать социальные сети отдельными ссылками

Сейчас один файл `socials.svg` содержит сразу четыре логотипа: LinkedIn, Instagram, Behance и Dribbble. В `index.html` этот файл подключён как одна картинка:

```html
<img src="src/icons/socials.svg" alt="socials">
```

Из-за этого браузер воспринимает четыре логотипа как один элемент. Нельзя сделать отдельную ссылку для каждой социальной сети, настроить отдельный `hover` или корректно описать каждую ссылку для скринридера.

Что сделать:

1. Разделить `socials.svg` на четыре отдельных файла:

```text
linkedin.svg
instagram.svg
behance.svg
dribbble.svg
```

2. Для каждой социальной сети создать отдельную ссылку.

3. Общий список оформить как один БЭМ-блок `.socials`.

Пример разметки:

```html
<ul class="socials" aria-label="Социальные сети">
  <li class="socials__item">
    <a
      class="socials__link"
      href="https://linkedin.com/..."
      aria-label="LinkedIn"
    >
      <img class="socials__icon" src="src/icons/linkedin.svg" alt="">
    </a>
  </li>

  <li class="socials__item">
    <a
      class="socials__link"
      href="https://instagram.com/..."
      aria-label="Instagram"
    >
      <img class="socials__icon" src="src/icons/instagram.svg" alt="">
    </a>
  </li>

  <li class="socials__item">
    <a
      class="socials__link"
      href="https://behance.net/..."
      aria-label="Behance"
    >
      <img class="socials__icon" src="src/icons/behance.svg" alt="">
    </a>
  </li>

  <li class="socials__item">
    <a
      class="socials__link"
      href="https://dribbble.com/..."
      aria-label="Dribbble"
    >
      <img class="socials__icon" src="src/icons/dribbble.svg" alt="">
    </a>
  </li>
</ul>
```

Пример стилей:

```css
.socials {
  display: flex;
  justify-content: center;
  gap: 32px;
  padding: 0;
  list-style: none;
}

.socials__link {
  display: block;
}

.socials__icon {
  display: block;
  width: 40px;
  height: 40px;
}
```

### 12. Оптимизировать изображения

Четыре основных изображения весят примерно **7,35 МБ**. Файлы портфолио имеют расширение SVG, но внутри них находятся большие растровые изображения в Base64.

Что сделать:

- уменьшить разрешение фотографий до размера, близкого к отображаемому;
- сжать и при необходимости конвертировать фотографии через [TinyPNG](https://tinypng.com/);
- для сайта предпочтительно сохранить результат в WebP или AVIF;
- добавить `loading="lazy"` изображениям ниже первого экрана;
- оставить SVG только для настоящей векторной графики — иконок и логотипов;
- указывать `width` и `height`, чтобы браузер заранее резервировал место.

Как использовать TinyPNG:

1. Открыть [https://tinypng.com/](https://tinypng.com/).
2. Подготовить растровые изображения в PNG, JPG, WebP или AVIF.
3. Перетащить изображения в область `Drop your images here!`.
4. При необходимости выбрать автоматическую конвертацию в WebP или AVIF.
5. Скачать сжатые файлы и поместить их в `src/img`.
6. Заменить пути к старым изображениям в `index.html`.
7. Проверить, что качество изображения визуально не испортилось, а размер файла уменьшился.

Важно: TinyPNG не предназначен для загрузки SVG. Файлы `woman.svg`, `reebok.svg` и `braun.svg` только называются векторными, но внутри содержат растровые изображения в Base64. Для них нужно получить исходную фотографию или сначала экспортировать содержимое в PNG/JPG, а затем сжать и конвертировать через TinyPNG. Настоящие векторные иконки сжимать этим способом не нужно.

В бесплатной форме TinyPNG можно обработать до 20 изображений за раз, размер каждого файла должен быть не больше 5 МБ.

Пример:

```html
<img
  src="src/img/braun.webp"
  alt="Концепт лендинга Braun"
  width="930"
  height="500"
  loading="lazy"
>
```

### 13. Исправить невалидные CSS-значения

В CSS есть значения, которые браузер игнорирует.

Неправильно:

```css
padding: 5;
font-style: solid;
letter-spacing: 0%;
```

Правильно:

```css
padding: 5px;
font-style: normal;
letter-spacing: 0;
```

У свойства `font-style` нет значения `solid`. Оно принимает, например, `normal`, `italic` или `oblique`.

У нулевых значений единица измерения не нужна:

```css
margin-right: 0;
```

### 14. Не использовать глобальные стили для всех `a` и `li`

Сейчас стили применяются сразу ко всем ссылкам и всем элементам списков:

```css
a {
}

li {
}
```

Если позже добавить новый список или ссылку, они неожиданно получат стили навигации.

Лучше использовать классы:

```css
.navigation__link {
}

.navigation__item {
}

.services__item {
}
```

Для работ портфолио также лучше использовать один общий класс `.portfolio-card`, а не отдельные `.woman`, `.rebook` и `.braun`.

### 15. Исправить названия и опечатки

Сейчас встречаются названия:

```text
discription
woman-disc
rebook
```

Лучше использовать:

```text
description
portfolio-card__description
reebok
```

Пробелы в названиях файлов тоже лучше заменить дефисами:

```text
graphic 1.svg → graphic-1.svg
startup 1.svg → startup-1.svg
chip bg.svg → chip-bg.svg
```

### 16. Удалить или подключить неиспользуемые CSS-файлы

В проекте есть `reset1.css` и `normalize1.css`, но HTML подключает только `style1.css`. При этом собственный reset уже находится в начале `style1.css`.

Нужно выбрать один вариант:

- оставить reset в `style1.css` и удалить неиспользуемые файлы;
- либо вынести reset в отдельный файл и подключить его перед основными стилями.

Одновременно использовать reset и normalize обычно не требуется.

## Рекомендуемый порядок исправлений

1. Заменить основное абсолютное позиционирование на Flexbox и Grid.
2. Выбрать понятные БЭМ-классы для основных компонентов.
3. Исправить структуру HTML.
4. Сделать рабочие ссылки навигации и кнопку сообщения.
5. Переделать услуги в отдельные карточки.
6. Добавить правильные заголовки.
7. Подключить Poppins.
8. Исправить невалидные CSS-значения.
9. Разделить `socials.svg` на четыре отдельные иконки-ссылки.
10. Оптимизировать изображения.
11. Почистить названия и неиспользуемые файлы.

После этих изменений проект можно повторно отправить на ревью. Адаптивность лучше реализовать отдельным следующим MR.
