import { CustomEmailSenderTriggerEvent } from 'aws-lambda';
import { default as customEmailSenderSignUpTriggerEvent } from './resources/custom-email-sender-sign-up-event.json';
import { default as customEmailSenderForgotPasswordTriggerEvent } from './resources/custom-email-sender-forgot-password-event.json';
import { handler } from '../src';

const signUpEvent: CustomEmailSenderTriggerEvent = customEmailSenderSignUpTriggerEvent as CustomEmailSenderTriggerEvent;
const forgotPasswordEvent: CustomEmailSenderTriggerEvent = customEmailSenderForgotPasswordTriggerEvent as CustomEmailSenderTriggerEvent;

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

jest.mock('@sendgrid/mail', () => {
    return {
        setApiKey: jest.fn(),
        send: jest.fn()
    };
});

describe('Test custom email sender', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        process.env.KEY_ID = 'test-key';
        process.env.SENDGRID_API_KEY = 'test-sendgrid-api-key';
        process.env.FROM_EMAIL = 'test@example.com';
        process.env.APP_BASE_URL = 'https://test.com';
        signUpEvent.request.code = 'dGVzdA==';
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
        process.env.SIGN_UP_TEMPLATE_ID = 'sign-up-template-id';
        process.env.SIGN_UP_SUBJECT = 'sign-up-subject';
        const response = await handler(signUpEvent);
        expect(response.templateId).toEqual('sign-up-template-id');
        expect(response.subject).toEqual('sign-up-subject');
        expect(response.personalizations).toEqual([
            {
                dynamicTemplateData: { cognito_link: 'https://test.com/auth/confirmRegistration?email=test@example.com&accessCode=test-code' },
                to: [{ email: 'test@example.com' }]
            }
        ]);
    });

    test('Test forgot email event', async () => {
        process.env.FORGOT_PASSWORD_TEMPLATE_ID = 'forgot-password-template-id';
        process.env.FORGOT_PASSWORD_SUBJECT = 'forgot-password-subject';
        process.env.FORGOT_PASSWORD_COGNITO_LINK = 'forgot-password-cognito-link';
        const response = await handler(forgotPasswordEvent);
        expect(response.templateId).toEqual('forgot-password-template-id');
        expect(response.subject).toEqual('forgot-password-subject');
        expect(response.personalizations).toEqual([
            {
                dynamicTemplateData: { cognito_link: 'https://test.com/auth/changePassword?email=test@example.com&accessCode=test-code' },
                to: [{ email: 'test@example.com' }]
            }
        ]);
    });

    test('Test non existent template id, subject and cognito link', async () => {
        delete process.env.FORGOT_PASSWORD_TEMPLATE_ID;
        delete process.env.FORGOT_PASSWORD_SUBJECT;
        await expect(handler(forgotPasswordEvent)).rejects.toThrow('Could not create message');
    });

    test('Test non existent from email', async () => {
        process.env.FORGOT_PASSWORD_TEMPLATE_ID = 'forgot-password-template-id';
        process.env.FORGOT_PASSWORD_SUBJECT = 'forgot-password-subject';
        delete process.env.FROM_EMAIL;
        await expect(handler(forgotPasswordEvent)).rejects.toThrow('From email not found');
    });

    test('Test non existent app base url', async () => {
        delete process.env.APP_BASE_URL;
        await expect(handler(forgotPasswordEvent)).rejects.toThrow('Unable to create link');
    });
});
