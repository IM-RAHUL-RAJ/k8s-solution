# Frontend

Angular 21 workspace for the trading platform UI.

## Feature tree

The first sprint slice is intentionally small so reviewers can find the entry points quickly:

```text
src/app/
	app.ts
	app.html
	app.css
	app.spec.ts
	app.routes.ts
	features/
		landing/
			landing-page.ts
			landing-page.html
			landing-page.css
			landing-page.spec.ts
```

## Scripts

```bash
npm ci
npm run build
npm test
```

## Local development

```bash
npm start
```

The app serves on `http://localhost:4200/`.
