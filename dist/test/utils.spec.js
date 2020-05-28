"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const utils_1 = require("../src/utils");
describe('various utils work', () => {
    describe('parses keys', () => {
        it('should use predefined default table name', () => {
            chai_1.expect(utils_1.parseDSKey('myKey', { schema: 'bla', defaultTable: 'default' }))
                .to.deep.equal({
                schema: 'bla',
                table: 'default',
                id: 'myKey',
            });
        });
        it('should use custom default table name', () => {
            const config = {
                schema: 'bla',
                defaultTable: 'customDefaultName'
            };
            chai_1.expect(utils_1.parseDSKey('myKey', config))
                .to.deep.equal({
                schema: 'bla',
                table: 'customDefaultName',
                id: 'myKey',
            });
        });
        it('should detect table name without a prefix', () => {
            chai_1.expect(utils_1.parseDSKey('myTable/myKey', { schema: 'bla' }))
                .to.deep.equal({
                schema: 'bla',
                table: 'myTable',
                id: 'myKey',
            });
        });
        it('should parse multiple slashes from key', () => {
            chai_1.expect(utils_1.parseDSKey('abcdefmy/key/is', { schema: 'bla' }))
                .to.deep.equal({
                schema: 'bla',
                table: 'abcdefmy',
                id: 'key/is',
            });
        });
    });
    describe('checks version', () => {
        it('should parse all 9.5+ versions', () => {
            const pgnine = 'PostgreSQL 9.5.9 on x86_64-pc-linux-gnu, compiled by gcc (Debian 4.9.2-10) 4.9.2, 64-bit';
            const pgten = 'PostgreSQL 10.0 on x86_64-pc-linux-gnu, compiled by gcc (Debian 4.9.2-10) 4.9.2, 64-bit';
            const pgtenone = 'PostgreSQL 10.0.1 on x86_64-pc-linux-gnu, compiled by gcc (Debian 4.9.2-10) 4.9.2, 64-bit';
            chai_1.expect(utils_1.parsePgVersion(pgnine)).to.deep.equal([9, 5, 9]);
            chai_1.expect(utils_1.parsePgVersion(pgten)).to.deep.equal([10, 0]);
            chai_1.expect(utils_1.parsePgVersion(pgtenone)).to.deep.equal([10, 0, 1]);
        });
        it('should throw if version is 9.5-', () => {
            const pgnine = 'PostgreSQL 9.4.1 on x86_64-pc-linux-gnu, compiled by gcc (Debian 4.9.2-10) 4.9.2, 64-bit';
            chai_1.expect(() => {
                utils_1.checkVersion(pgnine);
            }).to.throw(Error, 'postgres version is 9.4.1 but minimum version is 9.5');
        });
    });
});
//# sourceMappingURL=utils.spec.js.map