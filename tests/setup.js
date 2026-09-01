const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Mock the database connection in server.js so it doesn't connect to the real DB
jest.mock('../config/database', () => ({
  dbConnect: jest.fn()
}));

// Mock socket.io to avoid open handles and port conflicts
jest.mock('socket.io', () => {
    return {
        Server: jest.fn().mockImplementation(() => {
            return {
                on: jest.fn(),
                emit: jest.fn(),
            };
        })
    };
});

// Mock kafka to avoid connection attempts
jest.mock('kafkajs', () => {
    return {
        Kafka: jest.fn().mockImplementation(() => ({
            producer: jest.fn().mockImplementation(() => ({
                connect: jest.fn(),
                send: jest.fn(),
                disconnect: jest.fn(),
            })),
            consumer: jest.fn().mockImplementation(() => ({
                connect: jest.fn(),
                subscribe: jest.fn(),
                run: jest.fn(),
                disconnect: jest.fn(),
            }))
        }))
    };
});

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  process.env.JWT_ACCESS_SECRET = 'test-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.NODE_ENV = 'test';

  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  if (mongoose.connection) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany();
  }
});
