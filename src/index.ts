import { buildClient, CommitmentPolicy, KmsKeyringNode } from '@aws-crypto/client-node';
import { toByteArray } from 'base64-js';
import { CustomEmailSenderTriggerEvent } from 'aws-lambda';
import sendgrid from '@sendgrid/mail';
import { MailDataRequired } from '@sendgrid/helpers/classes/mail';
import { StringMap } from 'aws-lambda/trigger/cognito-user-pool-trigger/_common';

async function getPlainTextCode(event: CustomEmailSenderTriggerEvent) {
    if (!event.request.code) {
        throw Error('Could not find code');
    }

    if (!process.env.KEY_ID) {
        throw Error('Cannot decrypt code');
    }

    const client = buildClient(CommitmentPolicy.REQUIRE_ENCRYPT_ALLOW_DECRYPT);
    const generatorKeyId = process.env.KEY_ALIAS;
    const keyIds = [process.env.KEY_ID];
    const keyring = new KmsKeyringNode({ generatorKeyId, keyIds });

    let plainTextCode: string | undefined = undefined;
    const decryptOutput = await client.decrypt(keyring, toByteArray(event.request.code));
    plainTextCode = decryptOutput.plaintext.toString();

    return plainTextCode;
}

function createMessageObject(toEmail: string, plainTextCode: string, templateId: string, subject: string, cognitoLink: string): MailDataRequired {
    if (!process.env.FROM_EMAIL) {
        throw Error('From email not found');
    }

    return {
        from: process.env.FROM_EMAIL,
        subject: subject,
        personalizations: [
            {
                to: [
                    {
                        email: toEmail
                    }
                ],
                dynamicTemplateData: {
                    cognito_link: cognitoLink
                }
            }
        ],
        templateId: templateId
    };
}

function generateMessageToSend(event: CustomEmailSenderTriggerEvent, plainTextCode: string, toEmail: string) {
    let templateId = '';
    let subject = '';
    let cognitoLink = '';

    if (!(process.env.SIGN_UP_TEMPLATE_ID && process.env.SIGN_UP_SUBJECT)) {
        throw Error('Data to create sign up email is missing');
    }

    if (!(process.env.FORGOT_PASSWORD_TEMPLATE_ID && process.env.FORGOT_PASSWORD_SUBJECT)) {
        throw Error('Data to create forgot password email is missing');
    }

    if (!process.env.APP_BASE_URL) {
        throw Error('Unable to create link');
    }

    const maskedEmail = toEmail.replace(/^(.)(.*)(.@.*)$/, (_, a, b, c) => a + b.replace(/./g, '*') + c);

    if (event.triggerSource == 'CustomEmailSender_SignUp') {
        console.info(`Sending sign up email to ${maskedEmail}`);
        templateId = process.env.SIGN_UP_TEMPLATE_ID;
        subject = process.env.SIGN_UP_SUBJECT;
        cognitoLink = process.env.APP_BASE_URL + `/auth/confirmRegistration?email=${toEmail}&accessCode=${plainTextCode}`;
    } else if (event.triggerSource == 'CustomEmailSender_ForgotPassword') {
        console.info(`Sending forgotten password email to ${maskedEmail}`);
        templateId = process.env.FORGOT_PASSWORD_TEMPLATE_ID;
        subject = process.env.FORGOT_PASSWORD_SUBJECT;
        cognitoLink = process.env.APP_BASE_URL + `/auth/changePassword?email=${toEmail}&accessCode=${plainTextCode}`;
    } else {
        console.info(`Unhandled event type: ${event.triggerSource}`);
        return;
    }

    return createMessageObject(toEmail, plainTextCode, templateId, subject, cognitoLink);
}

export async function handler(event: CustomEmailSenderTriggerEvent): Promise<void> {
    if (!process.env.SENDGRID_API_KEY) {
        throw Error('Sendgrid API key not found');
    }

    sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

    const plainTextCode = await getPlainTextCode(event);
    const toEmail = (event.request.userAttributes as StringMap)['email'];
    const messageToSend: MailDataRequired | undefined = generateMessageToSend(event, plainTextCode, toEmail);

    if (messageToSend) {
        const response = await sendgrid.send(messageToSend);
        console.info(`Response Code: ${response[0].statusCode}, Message-ID: ${response[0].headers['x-message-id']}, Body: ${response[0].body}}`);
    }
}
