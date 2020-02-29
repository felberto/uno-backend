const request = require('supertest');
const app = require('../src');

describe('Test the root path', () => {
    test('It should response the GET method', () => {
        return request(app).get("/api").then(response => {
            expect(response.statusCode).toBe(200)
        })
    });
});