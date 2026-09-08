# n8n setup – Code à Cuisine

Workflows:
- `generate-recipe.workflow.json`
- `quota-status.workflow.json`
- `error-handler.workflow.json`

## Quota Data Table
Columns:
- `quotaKey` string
- `quota` number

Replace `SET_QUOTA_TABLE_ID` with the real table ID.

Keys used:
- `system:YYYY-MM-DD`
- `ip:YYYY-MM-DD:<IP>`
- `rate:<IP>`

IPv4 and IPv6 are accepted through `CF-Connecting-IP`, `X-Real-IP` or `X-Forwarded-For`.

## Gemini
Select your Gemini credential in `Gemini Model`.

The workflow validates output before quota is consumed. Validation covers exactly 3 unique recipes, valid titles, >=70% ingredient coverage, <=3 extras, selected portions/cooks/cuisine/diet/time, complete nutrition, consecutive directions, cook assignment and parallel work for multiple cooks.

## Error workflow
Create an error-log Data Table with:
- `logKey`
- `timestamp`
- `workflow`
- `execution`
- `message`

Replace `SET_ERROR_LOG_TABLE_ID`.

`Send Error Email` is disabled by default until SMTP is configured. After import, assign the Error Logger workflow as Error Workflow of the webhook workflows.
