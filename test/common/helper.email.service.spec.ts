import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer'; // Import MailerService

// Import Enum mới của bạn
import { EmailTemplate } from 'src/common/helper/interfaces/email.interface';
import { ISendEmailParams } from 'src/common/helper/interfaces/email.interface';
import { HelperEmailService } from 'src/common/helper/services/helper.email.service';

describe('HelperEmailService', () => {
    let service: HelperEmailService;
    let mailerServiceMock: jest.Mocked<MailerService>;
    let configServiceMock: jest.Mocked<ConfigService>;
    let module: TestingModule;

    const mockFromEmail = 'noreply@example.com';

    beforeEach(async () => {
        // Mock MailerService thay vì AwsSESService
        mailerServiceMock = {
            sendMail: jest.fn(),
        } as unknown as jest.Mocked<MailerService>;

        configServiceMock = {
            get: jest.fn().mockReturnValue(mockFromEmail),
        } as unknown as jest.Mocked<ConfigService>;

        module = await Test.createTestingModule({
            providers: [
                HelperEmailService,
                { provide: MailerService, useValue: mailerServiceMock },
                { provide: ConfigService, useValue: configServiceMock },
            ],
        }).compile();

        service = module.get<HelperEmailService>(HelperEmailService);
    });

    afterEach(async () => {
        jest.clearAllMocks();
        if (module) {
            await module.close();
        }
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('constructor', () => {
        it('should initialize fromEmail from ConfigService', () => {
            // Giả định key config của bạn đã đổi hoặc giữ nguyên
            expect(configServiceMock.get).toHaveBeenCalledWith(
                'email.from' // Ví dụ key config mới, hoặc giữ 'aws.ses.sourceEmail' nếu chưa đổi
            );
        });
    });

    describe('sendEmail', () => {
        const mockEmailParams: ISendEmailParams = {
            template: EmailTemplate.WELCOME, // Dùng Enum mới
            to: ['user@example.com'],
            subject: 'Welcome to SmartHome',
            context: { name: 'John Doe' },
        };

        // Mock kết quả trả về của Nodemailer
        const mockSendMailResponse = {
            messageId: 'mock-message-id',
            accepted: ['user@example.com'],
            rejected: [],
        };

        it('should send email successfully with all required parameters', async () => {
            mailerServiceMock.sendMail.mockResolvedValue(mockSendMailResponse);

            const result = await service.sendEmail(mockEmailParams);

            expect(result).toEqual(mockSendMailResponse);

            // Kiểm tra xem sendMail có được gọi đúng tham số của Nodemailer không
            expect(mailerServiceMock.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: mockEmailParams.to,
                    from: mockFromEmail,
                    template: mockEmailParams.template, // Tên file template (hbs)
                    context: mockEmailParams.context, // Dữ liệu truyền vào template
                    // Subject thường được xử lý bên trong service dựa trên emailType hoặc truyền vào
                    // subject: expect.any(String),
                })
            );

            expect(mailerServiceMock.sendMail).toHaveBeenCalledTimes(1);
        });

        it('should throw an error if email sending fails', async () => {
            const mockError = new Error('SMTP Connection failed');
            mailerServiceMock.sendMail.mockRejectedValue(mockError);

            await expect(service.sendEmail(mockEmailParams)).rejects.toThrow(
                'SMTP Connection failed'
            );
            expect(mailerServiceMock.sendMail).toHaveBeenCalledTimes(1);
        });

        it('should handle multiple recipients', async () => {
            const multipleRecipients = [
                'user1@example.com',
                'user2@example.com',
            ];
            const paramsWithMultipleRecipients = {
                ...mockEmailParams,
                emails: multipleRecipients,
            };

            mailerServiceMock.sendMail.mockResolvedValue(mockSendMailResponse);

            await service.sendEmail(paramsWithMultipleRecipients);

            expect(mailerServiceMock.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: multipleRecipients,
                    template: mockEmailParams.template,
                    context: mockEmailParams.context,
                })
            );
        });

        it('should handle empty payload', async () => {
            const paramsWithEmptyPayload = { ...mockEmailParams, payload: {} };

            mailerServiceMock.sendMail.mockResolvedValue(mockSendMailResponse);

            await service.sendEmail(paramsWithEmptyPayload);

            expect(mailerServiceMock.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    context: {},
                })
            );
        });

        it('should handle complex payload data', async () => {
            const complexPayload = {
                user: {
                    name: 'John Doe',
                    email: 'john@example.com',
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                },
            };

            const paramsWithComplexPayload = {
                ...mockEmailParams,
                payload: complexPayload,
            };

            mailerServiceMock.sendMail.mockResolvedValue(mockSendMailResponse);

            await service.sendEmail(paramsWithComplexPayload);

            expect(mailerServiceMock.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    context: complexPayload,
                })
            );
        });

        it('should handle single recipient as array', async () => {
            const singleRecipientParams = {
                ...mockEmailParams,
                emails: ['single@example.com'],
            };

            mailerServiceMock.sendMail.mockResolvedValue(mockSendMailResponse);

            await service.sendEmail(singleRecipientParams);

            expect(mailerServiceMock.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: ['single@example.com'],
                })
            );
        });
    });
});
