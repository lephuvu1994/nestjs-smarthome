import { Test, TestingModule } from '@nestjs/testing';
import { SocketService } from 'src/modules/socket/services/socket.service';
import { Server } from 'socket.io';

describe('SocketService', () => {
    let service: SocketService;
    let mockServer: any;

    beforeEach(async () => {
        // 1. Tạo Mock cho Socket.io Server
        mockServer = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
            except: jest.fn().mockReturnThis(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [SocketService],
        }).compile();

        service = module.get<SocketService>(SocketService);
        // Gán mock server vào service
        service.server = mockServer as unknown as Server;
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('handleConnection', () => {
        it('should add a new connection for a user', () => {
            const userId = 'user-1';
            const socketId = 'socket-a';

            service.handleConnection(userId, socketId);

            // Truy cập private member để kiểm tra (hoặc thông qua hành vi sendToUser)
            // Ở đây ta dùng cách gọi sendToUser để gián tiếp kiểm tra Map
            service.sendToUser(userId, 'test', {});
            expect(mockServer.to).toHaveBeenCalledWith([socketId]);
        });

        it('should support multiple socket IDs for one user', () => {
            const userId = 'user-1';
            service.handleConnection(userId, 'socket-1');
            service.handleConnection(userId, 'socket-2');

            service.sendToUser(userId, 'test', {});
            expect(mockServer.to).toHaveBeenCalledWith([
                'socket-1',
                'socket-2',
            ]);
        });
    });

    describe('handleDisconnection', () => {
        it('should remove a specific socket and keep others for the same user', () => {
            const userId = 'user-1';
            service.handleConnection(userId, 'socket-1');
            service.handleConnection(userId, 'socket-2');

            service.handleDisconnection(userId, 'socket-1');

            service.sendToUser(userId, 'test', {});
            expect(mockServer.to).toHaveBeenCalledWith(['socket-2']);
        });

        it('should delete user from map when no sockets left', () => {
            const userId = 'user-1';
            service.handleConnection(userId, 'socket-1');
            service.handleDisconnection(userId, 'socket-1');

            // Sau khi xóa hết, sendToUser sẽ return sớm và ko gọi mockServer
            service.sendToUser(userId, 'test', {});
            expect(mockServer.to).not.toHaveBeenCalled();
        });
    });

    describe('Messaging Methods', () => {
        const payload = { data: 'hello' };
        const event = 'message';

        it('should broadcast to all users', () => {
            service.broadcast(event, payload);
            expect(mockServer.emit).toHaveBeenCalledWith(event, payload);
        });

        it('should not broadcast if server is null', () => {
            service.server = null;
            expect(() => service.broadcast(event, payload)).not.toThrow();
            expect(mockServer.emit).not.toHaveBeenCalled();
        });

        it('should send to specific user sockets', () => {
            service.handleConnection('u1', 's1');
            service.sendToUser('u1', event, payload);
            expect(mockServer.to).toHaveBeenCalledWith(['s1']);
            expect(mockServer.emit).toHaveBeenCalledWith(event, payload);
        });

        it('should broadcast except a specific socket', () => {
            service.broadcastExcept('socket-skip', event, payload);
            expect(mockServer.except).toHaveBeenCalledWith('socket-skip');
            expect(mockServer.emit).toHaveBeenCalledWith(event, payload);
        });
    });
});
