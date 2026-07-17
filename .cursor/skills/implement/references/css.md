# CSS / Tailwind v4

Apply when writing or modifying `.css` files or UI in `.tsx`.

- No `tailwind.config.js` — all tokens defined in `@theme inline` in CSS only.
- No `@apply` — defeats the purpose of utility-first and creates hidden coupling.
- No bracket variables in class names unless it's a custom value.
- Mobile-first responsive design using Tailwind breakpoint prefixes (`sm:`, `md:`, `lg:`).
