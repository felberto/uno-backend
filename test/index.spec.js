const expect = require('chai').expect;
const server = require('../index');


test('should return a string', async () => {
    expect("uno backend").to.equal("uno backend");
});