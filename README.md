# cognito-custom-email-sender

A lambda which sends out custom emails for Cognito


## Configuration

### Environment variables

| Environment Variable | Description | Required |
| --- | --- | --- |
| KEY_ID | KMS key id to decrypt email code | Yes |
| KEY_ALIAS | Alias of the KMS key | Yes |
| FROM_EMAIL | Email sending the emails | Yes |
| SIGN_UP_TEMPLATE_ID | Sign up email template id | Yes |
| SIGN_UP_SUBJECT | Sign up email subject | Yes |
| FORGOT_PASSWORD_TEMPLATE_ID | Forgot password email template id | Yes |
| FORGOT_PASSWORD_SUBJECT | Forgot password email subject | Yes |
| APP_BASE_URL | Base url for the links | Yes |
| SENDGRID_API_KEY | Api key to send email from sendgrid | Yes |


## Build

To build the lambda function run the following.

```
npm install
npm run build
```

## Test

To run the tests.

```
npm test
```

## Package

The following will package the lambda function into a zip bundle to allow manual deployment.

```
zip -q -r dist/lambda.zip node_modules dist
```

### Further changes to be made?
