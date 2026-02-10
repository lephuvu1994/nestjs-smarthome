import { Test, TestingModule } from '@nestjs/testing';
import { EmailProcessorWorker } from 'src/workers/processors/email.processor'; // Sửa lại đường dẫn nếu cần
import { HelperEmailService } from 'src/common/helper/services/helper.email.service';
import { PinoLogger } from 'nestjs-pino';
import { Job } from 'bullmq';
import { EmailTemplate } from 'src/common/helper/interfaces/email.interface';
import { EMAIL_SUBJECTS } from 'src/common/constants/email.constant';

describe('EmailProcessorWorker', () => {
    let worker: EmailProcessorWorker;
    let helperEmailServiceMock: any;
    let loggerMock: any;

    // Dữ liệu mẫu cho Job
    const mockWelcomeJobData = {
        to: 'user@example.com',
        context: { name: 'Test User' },
    };

    const mockForgotPassJobData = {
        to: 'user@example.com',
        context: { code: '123456', url: 'http://reset' },
    };

    beforeEach(async () => {
        // 1. Mock HelperEmailService
        helperEmailServiceMock = {
            sendEmail: jest.fn().mockResolvedValue(true),
        };

        // 2. Mock PinoLogger
        loggerMock = {
            setContext: jest.fn(),
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
        };

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

        worker = module.get<EmailProcessorWorker>(EmailProcessorWorker);
    });

    it('should be defined', () => {
        expect(worker).toBeDefined();
    });

    // --- CASE 1: Welcome Email ---
    describe('process (Welcome Email)', () => {
        it('should route to handleWelcomeEmail and send email successfully', async () => {
            // Tạo Job giả
            const job = {
                id: '1',
                name: EmailTemplate.WELCOME, // Quan trọng: name phải khớp case switch
                data: mockWelcomeJobData,
            } as Job;

            // Gọi hàm process (WorkerHost sẽ gọi hàm này)
            await worker.process(job);

            // Kiểm tra log info được gọi (Processing...)
            expect(loggerMock.info).toHaveBeenCalledWith(
                expect.objectContaining({ jobId: job.id }),
                expect.stringContaining('Processing welcome email')
            );

            // Kiểm tra service gửi mail được gọi đúng tham số
            expect(helperEmailServiceMock.sendEmail).toHaveBeenCalledWith({
                to: mockWelcomeJobData.to,
                subject: EMAIL_SUBJECTS.WELCOME,
                template: EmailTemplate.WELCOME,
                context: mockWelcomeJobData.context,
            });

            // Kiểm tra log success
            expect(loggerMock.info).toHaveBeenCalledWith(
                expect.objectContaining({ jobId: job.id }),
                'Welcome email sent successfully'
            );
        });

        it('should throw error if sending welcome email fails', async () => {
            const error = new Error('SMTP Error');
            helperEmailServiceMock.sendEmail.mockRejectedValue(error);

            const job = {
                id: '1',
                name: EmailTemplate.WELCOME,
                data: mockWelcomeJobData,
            } as Job;

            // Expect hàm process ném lỗi ra ngoài (để BullMQ biết mà retry)
            await expect(worker.process(job)).rejects.toThrow(error);

            // Kiểm tra log error có được ghi lại không
            expect(loggerMock.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    jobId: job.id,
                    error: error.message,
                }),
                'Failed to send welcome email'
            );
        });
    });

    // --- CASE 2: Forgot Password Email ---
    describe('process (Forgot Password Email)', () => {
        it('should route to handleForgotPasswordEmail and send email successfully', async () => {
            const job = {
                id: '2',
                name: EmailTemplate.FORGOT_PASSWORD,
                data: mockForgotPassJobData,
            } as Job;

            await worker.process(job);

            expect(helperEmailServiceMock.sendEmail).toHaveBeenCalledWith({
                to: mockForgotPassJobData.to,
                subject: EMAIL_SUBJECTS.FORGOT_PASSWORD,
                template: EmailTemplate.FORGOT_PASSWORD,
                context: mockForgotPassJobData.context,
            });

            expect(loggerMock.info).toHaveBeenCalledWith(
                expect.objectContaining({ jobId: job.id }),
                'Forgot password email sent successfully'
            );
        });

        it('should throw error if sending forgot password email fails', async () => {
            const error = new Error('Network Error');
            helperEmailServiceMock.sendEmail.mockRejectedValue(error);

            const job = {
                id: '2',
                name: EmailTemplate.FORGOT_PASSWORD,
                data: mockForgotPassJobData,
            } as Job;

            await expect(worker.process(job)).rejects.toThrow('Network Error');

            expect(loggerMock.error).toHaveBeenCalledWith(
                expect.objectContaining({ jobId: job.id }),
                'Failed to send forgot pass'
            );
        });
    });

    // --- CASE 3: Unknown Job ---
    describe('process (Unknown Job)', () => {
        it('should warn and do nothing for unknown job names', async () => {
            const job = {
                id: '3',
                name: 'UNKNOWN_JOB_NAME', // Tên job lạ
                data: {},
            } as Job;

            await worker.process(job);

            // Kiểm tra log warn
            expect(loggerMock.warn).toHaveBeenCalledWith(
                `No handler for job name: ${job.name}`
            );

            // Đảm bảo không gọi gửi mail
            expect(helperEmailServiceMock.sendEmail).not.toHaveBeenCalled();
        });
    });
});
