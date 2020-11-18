import * as loader from '@grpc/proto-loader';
import * as grpcNative from 'grpc';
import {sendUnaryData, ServerUnaryCall} from 'grpc';
import * as grpcJs from '@grpc/grpc-js';
import {expect} from 'chai';

const proto = loader.loadSync(require.resolve('../proto/service.proto'));

class ServiceImpl {

  constructor(private readonly client: any, private readonly mkMetadata: any) {
  }

  CallSelf(call: ServerUnaryCall<{}>, callback: sendUnaryData<{}>) {
    this.client.Delay({delay: 500}, this.mkMetadata(), {parent: call, deadline: Date.now() + 10}, (err, result) => {
      callback(null, {message: err});
    });
  };

  Delay(call: ServerUnaryCall<{delay: number}>, callback: sendUnaryData<{}>) {
    setTimeout(() => {
      callback(null, {});
    }, call.request.delay);
  };
}

describe('minimum deadline', function () {

  this.timeout(10000);

  const suites = {
    'native': grpcNative,
    'js': grpcJs,
  };

  Object.keys(suites).forEach(label => {

    describe(label, () => {

      const {client, mkMetadata} = setup(suites[label]);

      it('uses minimum deadline between parent and current call', done => {
        client.CallSelf({}, mkMetadata(), {deadline: Date.now() + 1000}, (err, result) => {
          expect(result).to.have.property('message').that.matches(/DEADLINE/);
          done();
        });
      });
    });
  });

  function setup(grpc: any) {
    const packageDef = grpc.loadPackageDefinition(proto) as any;
    const mkMetadata = () => new grpc.Metadata();
    const server = new grpc.Server();
    const client = new packageDef.wix.Service('localhost:3001', grpc.credentials.createInsecure());
    const service = new ServiceImpl(client, mkMetadata);
    server.addService(packageDef.wix.Service.service, service);
    before(done => {
      server.bindAsync('0.0.0.0:3001', (grpc as any).ServerCredentials.createInsecure(), err => {
        if (err) {
          done(err);
        } else {
          server.start();
          done();
        }
      })
    });
    after(() => {
      server.forceShutdown();
    });

    return {client, mkMetadata};
  }
});
