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
        from: process.env.FROM_EMAIL, // Change to your verified sender
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

    if (!process.env.APP_BASE_URL) {
        throw Error('Unable to create link');
    }

    if (event.triggerSource == 'CustomEmailSender_SignUp' && process.env.SIGN_UP_TEMPLATE_ID && process.env.SIGN_UP_SUBJECT) {
        templateId = process.env.SIGN_UP_TEMPLATE_ID;
        subject = process.env.SIGN_UP_SUBJECT;
        cognitoLink = process.env.APP_BASE_URL + `/auth/confirmRegistration?email=${toEmail}&accessCode=${plainTextCode}`;
    } else if (
        event.triggerSource == 'CustomEmailSender_ForgotPassword' &&
        process.env.FORGOT_PASSWORD_TEMPLATE_ID &&
        process.env.FORGOT_PASSWORD_SUBJECT
    ) {
        templateId = process.env.FORGOT_PASSWORD_TEMPLATE_ID;
        subject = process.env.FORGOT_PASSWORD_SUBJECT;
        cognitoLink = process.env.APP_BASE_URL + `/auth/changePassword?email=${toEmail}&accessCode=${plainTextCode}`;
    } else {
        throw Error('Could not create message');
    }

    return createMessageObject(toEmail, plainTextCode, templateId, subject, cognitoLink);
}

export async function handler(event: CustomEmailSenderTriggerEvent): Promise<MailDataRequired> {
    const plainTextCode = await getPlainTextCode(event);
    const toEmail = (event.request.userAttributes as StringMap)['email'];

    if (!process.env.SENDGRID_API_KEY) {
        throw Error('Sendgrid API key not found');
    }

    sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
    const messageToSend: MailDataRequired = generateMessageToSend(event, plainTextCode, toEmail);
    await sendgrid.send(messageToSend);

    return messageToSend;
}
