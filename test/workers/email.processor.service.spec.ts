import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq'; // 1. Đổi sang bullmq
import { PinoLogger } from 'nestjs-pino';

// 2. Import Enum mới (đường dẫn tuỳ project của bạn)
import {
    ISendEmailParams,
    EmailTemplate,
    IWelcomeEmailContext,
} from 'src/common/helper/interfaces/email.interface';
import { HelperEmailService } from 'src/common/helper/services/helper.email.service';
import { EmailProcessorWorker } from 'src/workers/processors/email.processor';

describe('EmailProcessorWorker', () => {
    let service: EmailProcessorWorker;
    let helperEmailServiceMock: jest.Mocked<HelperEmailService>;
    let loggerMock: jest.Mocked<PinoLogger>;

    beforeEach(async () => {
        // Mock HelperEmailService
        helperEmailServiceMock = {
            sendEmail: jest.fn(),
        } as unknown as jest.Mocked<HelperEmailService>;

        // Mock PinoLogger
        loggerMock = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            setContext: jest.fn(),
            // ... các hàm khác nếu cần
        } as unknown as jest.Mocked<PinoLogger>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EmailProcessorWorker,
                {
                    provide: HelperEmailService,
                    useValue: helperEmailServiceMock,
                },
                {
                    provide: PinoLogger,
                    useValue: loggerMock,
                },
            ],
        }).compile();

        service = module.get<EmailProcessorWorker>(EmailProcessorWorker);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('processWelcomeEmails', () => {
        it('should process the welcome email job and call sendEmail with correct params', async () => {
            // 3. Setup dữ liệu test
            const emailPayload: IWelcomeEmailContext = {
                userName: 'Test User',
            };

            const jobData: ISendEmailParams = {
                to: ['test@example.com'],
                subject: 'Welcome to SmartHome',
                template: EmailTemplate.WELCOME,
                context: emailPayload,
            };

            // Mock Job của BullMQ
            const jobMock = {
                name: 'welcomeEmail',
                data: jobData,
            } as Job<ISendEmailParams>;

            // 4. Chạy hàm cần test
            await service.process(jobMock);

            // 5. Kiểm tra logic gọi hàm sendEmail (Logic Nodemailer)
            // Lưu ý: Cấu trúc bên dưới phải khớp với code sendEmail thực tế bạn đã sửa
            expect(helperEmailServiceMock.sendEmail).toHaveBeenCalledWith({
                to: jobData.to,
                subject: 'Welcome to SmartHome', // Subject thường được fix cứng hoặc lấy từ config
                template: EmailTemplate.WELCOME, // Enum mới
                context: {
                    userName: 'Test User', // Dữ liệu để map vào file .hbs
                },
            });

            // Kiểm tra log có được gọi không
            expect(loggerMock.info).toHaveBeenCalled();
        });
    });
});
