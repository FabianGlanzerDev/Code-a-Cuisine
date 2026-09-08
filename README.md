# Code à Cuisine

Code à Cuisine is an Angular recipe generator that sends selected ingredients and preferences to n8n, generates three recipe suggestions with Gemini and stores successful recipes in Firebase Realtime Database.

## Requirements
- Node.js and npm
- Firebase Realtime Database
- n8n with the workflows from `n8n/`
- Gemini credential in n8n

## Install and start
```bash
npm install
npm start
```

## Production build
```bash
npm install
npm run build
```

`node_modules` is intentionally not part of the submission ZIP.

## GitHub repository
Replace before submission:
`REPLACE_WITH_GITHUB_REPOSITORY_URL`

## Main features
- Angular frontend with responsive layouts
- Ingredient input with amount, unit, edit and delete
- 1–12 portions, default 2
- 1–3 cooks with task assignment
- Quick, Medium and Complex cooking-time categories
- German, Italian, Japanese, Indian, Gourmet and Fusion cuisines
- Vegetarian, Vegan, Keto and No preferences
- exactly three generated recipe suggestions
- n8n request/AI-response validation
- at least 70% of supplied ingredients per recipe
- maximum three extra ingredients
- chronological directions and parallel tasks for multiple cooks
- nutrition per portion and whole recipe including macro percentages
- IP quota 3 recipe suggestions/day
- system quota 12 recipe suggestions/day
- short n8n rate limit
- Firebase persistence and likes
- cookbook, cuisine views and recipe details
- pagination above 20 recipes
- loading and readable error states
- imprint route at `/imprint`
- n8n error logging workflow

See `FINAL_HANDOFF.md` for the few account-specific steps still required before submission.
