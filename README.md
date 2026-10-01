# Наш малыш — готовая версия

Простое семейное приложение без регистрации.

- Кнопка «ТОЛЧОК»
- Точная дата и время до секунды
- Синхронизация двух телефонов
- История
- Статистика за месяц
- Автоматическое удаление данных старше месяца
- PWA для телефона

## Supabase
Anonymous Sign-Ins должны быть включены.
После этого один раз выполните `supabase.sql`.

ВАЖНО: не выполняйте повторно `alter publication supabase_realtime add table public.kicks` — kicks уже подключена к Realtime.

## GitHub
Загрузите ВСЕ файлы архива в корень репозитория:
`kostyashtin-art/sashashtin`

После Commit дождитесь GitHub Actions.

Сайт:
https://kostyashtin-art.github.io/sashashtin/
