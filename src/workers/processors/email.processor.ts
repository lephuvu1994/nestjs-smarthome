import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { PinoLogger } from 'nestjs-pino';

import { APP_BULL_QUEUES } from 'src/app/enums/app.enum';
// Import Enum và Constant mới
import { EmailTemplate, ISendEmailParams } from 'src/common/helper/interfaces/email.interface';
import { EMAIL_SUBJECTS } from 'src/common/constants/email.constant'; // File constant chứa tiêu đề
import { HelperEmailService } from 'src/common/helper/services/helper.email.service';

@Processor(APP_BULL_QUEUES.EMAIL)
export class EmailProcessorWorker {
    constructor(
        private readonly helperEmailService: HelperEmailService,
        private readonly logger: PinoLogger
    ) {
        this.logger.setContext(EmailProcessorWorker.name);
    }

    // Process dựa trên tên string của template (ví dụ: 'welcome')
    @Process(EmailTemplate.WELCOME)
    async processWelcomeEmails(
        job: Job<ISendEmailParams>
    ) {
        // Payload lúc add job vào queue sẽ có dạng: { to: '...', context: { userName: '...' } }
        const { to, context } = job.data;

        this.logger.info(
            { jobId: job.id, recipient: to },
            'Processing welcome email job'
        );

        try {
            await this.helperEmailService.sendEmail({
                to: to,
                subject: EMAIL_SUBJECTS.WELCOME, // Lấy tiêu đề "Chào mừng..." từ constant
                template: EmailTemplate.WELCOME, // 'welcome.hbs'
                context: context, // Dữ liệu để fill vào {{userName}}
            });

            this.logger.info(
                { jobId: job.id },
                'Welcome emails sent successfully'
            );
        } catch (error) {
            this.logger.error(
                { jobId: job.id, error: error.message },
                `Failed to send welcome emails: ${error.message}`
            );
            // Quan trọng: Throw lỗi để Bull Queue biết job fail và có thể retry
            throw error;
        }
    }

    @Process(EmailTemplate.FORGOT_PASSWORD)
    async processForgotPassword(job: Job<ISendEmailParams>) {
        const { to, context } = job.data;
        // context lúc này sẽ chứa { userName: '...', otp: '123456' }

        this.logger.info({ jobId: job.id }, 'Processing forgot password email');

        try {
            await this.helperEmailService.sendEmail({
                to: to,
                subject: EMAIL_SUBJECTS.FORGOT_PASSWORD, // "Mã xác nhận khôi phục mật khẩu"
                template: EmailTemplate.FORGOT_PASSWORD, // 'forgot-password.hbs'
                context: context,
            });

            this.logger.info({ jobId: job.id }, 'Forgot password email sent successfully');
        } catch (error) {
            this.logger.error({ jobId: job.id, error: error.message }, 'Failed send forgot pass');
            throw error; // Throw để Bull retry
        }
    }
}
