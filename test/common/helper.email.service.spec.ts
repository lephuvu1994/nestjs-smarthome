import { Test, TestingModule } from '@nestjs/testing';
import { HelperEmailService } from 'src/common/helper/services/helper.email.service';
import { MailerService } from '@nestjs-modules/mailer';
import { Logger } from '@nestjs/common';

describe('HelperEmailService', () => {
    let service: HelperEmailService;
    let mailerServiceMock: any;

    // Mock dữ liệu mẫu
    const mockPayload = {
        to: 'test@example.com',
        subject: 'Test Subject',
        template: 'test-template',
        context: { name: 'Test User' },
    };

    beforeAll(() => {
        // Tắt Logger của NestJS để output test cho gọn (không in log Error/Log ra console)
        jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    });

    beforeEach(async () => {
        // 1. Tạo Mock cho MailerService
        mailerServiceMock = {
            sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HelperEmailService,
                {
                    provide: MailerService,
                    useValue: mailerServiceMock,
                },
            ],
        }).compile();

        service = module.get<HelperEmailService>(HelperEmailService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // --- TEST 1: Hàm chung sendEmail ---
    describe('sendEmail', () => {
        it('should call mailerService.sendMail with correct parameters', async () => {
            await service.sendEmail(mockPayload);

            // Kiểm tra xem hàm sendMail của thư viện có được gọi đúng không
            expect(mailerServiceMock.sendMail).toHaveBeenCalledWith({
                to: mockPayload.to,
                subject: mockPayload.subject,
                template: `./${mockPayload.template}`, // Logic trong code của bạn có thêm "./"
                context: mockPayload.context,
            });
            expect(mailerServiceMock.sendMail).toHaveBeenCalledTimes(1);
        });

        it('should log error and re-throw if sending fails', async () => {
            // Giả lập lỗi SMTP
            const error = new Error('SMTP Error');
            mailerServiceMock.sendMail.mockRejectedValue(error);

            // Expect hàm sẽ ném lỗi ra ngoài (để Queue bắt được)
            await expect(service.sendEmail(mockPayload)).rejects.toThrow(
                'SMTP Error'
            );

            // Đảm bảo hàm sendMail vẫn được gọi 1 lần
            expect(mailerServiceMock.sendMail).toHaveBeenCalledTimes(1);
        });
    });

    // --- TEST 2: Hàm cụ thể sendForgotPassword ---
    describe('sendForgotPassword', () => {
        it('should construct correct URL and context, then call sendEmail', async () => {
            const email = 'user@example.com';
            const name = 'John Doe';
            const token = 'abc-123-token';

            // Spy vào hàm sendEmail của chính service đó để xem nó nhận được gì
            const sendEmailSpy = jest.spyOn(service, 'sendEmail');

            await service.sendForgotPassword(email, name, token);

            // Kiểm tra logic tạo URL
            const expectedUrl = `https://your-app.com/reset-password?token=${token}`;

            // Kiểm tra hàm sendEmail được gọi với đúng tham số đã chế biến
            expect(sendEmailSpy).toHaveBeenCalledWith({
                to: email,
                subject: 'Khôi phục mật khẩu Smart Home',
                template: 'forgot-password',
                context: {
                    name: name,
                    url: expectedUrl,
                },
            });

            // Kiểm tra sâu hơn: MailerService thực tế được gọi như thế nào
            expect(mailerServiceMock.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: email,
                    template: './forgot-password', // Code gốc nối thêm "./"
                    context: expect.objectContaining({
                        url: expectedUrl,
                    }),
                })
            );
        });
    });
});
