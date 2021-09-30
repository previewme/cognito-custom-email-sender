import { CustomEmailSenderTriggerEvent } from 'aws-lambda';
import { buildClient, CommitmentPolicy, KmsKeyringNode } from '@aws-crypto/client-node';
import { toByteArray } from 'base64-js';
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

    const { decrypt } = buildClient(CommitmentPolicy.REQUIRE_ENCRYPT_ALLOW_DECRYPT);
    const generatorKeyId = process.env.KEY_ALIAS;
    const keyIds = [process.env.KEY_ID];
    const keyring = new KmsKeyringNode({ generatorKeyId, keyIds });

    let plainTextCode: string | undefined = undefined;
    const { plaintext } = await decrypt(keyring, toByteArray(event.request.code));
    plainTextCode = plaintext.toString();

    return plainTextCode;
}

export async function handler(event: CustomEmailSenderTriggerEvent) {
    const plainTextCode = await getPlainTextCode(event);
    const toEmail = (event.request.userAttributes as StringMap)['email'];
    sendgrid.setApiKey(process.env.SENDGRID_API_KEY!);
    sendgrid.setSubstitutionWrappers('{{', '}}');
    const msg: MailDataRequired = {
        to: toEmail,
        from: 'hello-test@previewme.co', // Change to your verified sender
        subject: 'Sending with SendGrid is Fun',
        personalizations: [
            {
                to: [
                    {
                        email: toEmail
                    }
                ],
                dynamicTemplateData: {
                    cognito_link: `/auth/changePassword?email=${toEmail}&accessCode=${plainTextCode}`
                }
            }
        ],
        templateId: process.env.TEMPLATE_ID!
    };

    await sendgrid.send(msg);
}

exports.handler = handler;
