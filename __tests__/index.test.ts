import { CustomEmailSenderTriggerEvent } from 'aws-lambda';
import { default as customEmailSenderSignUpTriggerEvent } from './resources/custom-email-sender-sign-up-event.json';
import { default as customEmailSenderForgotPasswordTriggerEvent } from './resources/custom-email-sender-forgot-password-event.json';
import { handler } from '../src';
import sendgrid from '@sendgrid/mail';

const signUpEvent: CustomEmailSenderTriggerEvent = customEmailSenderSignUpTriggerEvent as CustomEmailSenderTriggerEvent;
const forgotPasswordEvent: CustomEmailSenderTriggerEvent = customEmailSenderForgotPasswordTriggerEvent as CustomEmailSenderTriggerEvent;

jest.mock('@sendgrid/mail', () => {
    return {
        send: jest.fn(() => {
            return [
                {
                    statusCode: '202',
                    body: 'body',
                    headers: {
                        'x-message-id': 'test-id'
                    }
                }
            ];
        }),
        setApiKey: jest.fn()
    };
});

jest.mock('@aws-crypto/client-node', () => {
    return {
        buildClient: jest.fn(() => {
            return {
                decrypt: jest.fn(() => {
                    return {
                        plaintext: 'test-code'
                    };
                })
            };
        }),
        KmsKeyringNode: jest.fn().mockImplementation(),
        CommitmentPolicy: 'test'
    };
});

describe('Test custom email sender', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        process.env.KEY_ID = 'test-key';
        process.env.SENDGRID_API_KEY = 'test-sendgrid-api-key';
        process.env.FROM_EMAIL = 'test@fromemail.com';
        process.env.APP_BASE_URL = 'https://test.com';
        process.env.SIGN_UP_TEMPLATE_ID = 'sign-up-template-id';
        process.env.SIGN_UP_SUBJECT = 'sign-up-subject';
        process.env.FORGOT_PASSWORD_TEMPLATE_ID = 'forgot-password-template-id';
        process.env.FORGOT_PASSWORD_SUBJECT = 'forgot-password-subject';
        signUpEvent.request.code = 'dGVzdA==';
        signUpEvent.triggerSource = 'CustomEmailSender_SignUp';
    });

    test('Test non existent code', async () => {
        signUpEvent.request.code = null;
        await expect(handler(signUpEvent)).rejects.toThrow('Could not find code');
    });

    test('Test non existent key id', async () => {
        delete process.env.KEY_ID;
        await expect(handler(signUpEvent)).rejects.toThrow('Cannot decrypt code');
    });

    test('Test non existent sendgrid api key', async () => {
        delete process.env.SENDGRID_API_KEY;
        await expect(handler(signUpEvent)).rejects.toThrow('Sendgrid API key not found');
    });

    test('Test sign up event', async () => {
        await handler(signUpEvent);
        expect(sendgrid.send).toHaveBeenCalledWith({
            from: 'test@fromemail.com', // Change to your verified sender
            subject: 'sign-up-subject',
            personalizations: [
                {
                    to: [
                        {
                            email: 'test@toemail.com'
                        }
                    ],
                    dynamicTemplateData: {
                        cognito_link: 'https://test.com/auth/confirmRegistration?email=test@toemail.com&accessCode=test-code'
                    }
                }
            ],
            templateId: 'sign-up-template-id'
        });
    });

    test('Test forgot password email event', async () => {
        await handler(forgotPasswordEvent);
        expect(sendgrid.send).toHaveBeenCalledWith({
            from: 'test@fromemail.com', // Change to your verified sender
            subject: 'forgot-password-subject',
            personalizations: [
                {
                    to: [
                        {
                            email: 'test@toemail.com'
                        }
                    ],
                    dynamicTemplateData: {
                        cognito_link: 'https://test.com/auth/changePassword?email=test@toemail.com&accessCode=test-code'
                    }
                }
            ],
            templateId: 'forgot-password-template-id'
        });
    });

    test('Test unsupported trigger source', async () => {
        signUpEvent.triggerSource = 'CustomEmailSender_ResendCode';
        await handler(signUpEvent);
        expect(sendgrid.send).toHaveBeenCalledTimes(0);
    });

    test('Test non existent forget password template id and subject', async () => {
        delete process.env.FORGOT_PASSWORD_TEMPLATE_ID;
        delete process.env.FORGOT_PASSWORD_SUBJECT;
        await expect(handler(forgotPasswordEvent)).rejects.toThrow('Data to create forgot password email is missing');
    });

    test('Test non existent sign up template id and subject', async () => {
        delete process.env.SIGN_UP_TEMPLATE_ID;
        delete process.env.SIGN_UP_SUBJECT;
        await expect(handler(forgotPasswordEvent)).rejects.toThrow('Data to create sign up email is missing');
    });

    test('Test non existent from email', async () => {
        delete process.env.FROM_EMAIL;
        await expect(handler(forgotPasswordEvent)).rejects.toThrow('From email not found');
    });

    test('Test non existent app base url', async () => {
        delete process.env.APP_BASE_URL;
        await expect(handler(forgotPasswordEvent)).rejects.toThrow('Unable to create link');
    });
});
