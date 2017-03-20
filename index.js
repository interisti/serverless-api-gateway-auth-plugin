'use strict';


/**
 * Adds the posibility to configure AWS_IAM for your API Gateway endpoints
 * and "Invoke with caller credentials"
 *
 * Usage:
 *
 *   myFuncGetItem:
 *     handler: myFunc.get
 *     name: ${self:provider.stage}-myFunc-get-item
 *     memorySize: 128
 *     events:
 *       - http:
 *           method: GET
 *           path: mypath
 *           cors: true
 *           useIAMAuth: true
 *           invokeWithCallerCredentials: true
 */
class ServerlessApiGatewayAuthPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.hooks = {
      'deploy:compileEvents': this._compileEvents.bind(this)
    };
  }

  _capitalizeAlphaNumericPath(path) {
    path = path.toLowerCase();
    path = path.charAt(0).toUpperCase() + path.slice(1);
    return path.replace(/-/g, 'Dash')
      .replace(/\{(.*)\}/g, '$1Var')
      .replace(/[^0-9A-Za-z]/g, '');
  }

  _compileEvents() {
    const tmp = this.serverless.service.provider.compiledCloudFormationTemplate;
    const resources = tmp.Resources;
    const iamFunctions = this.serverless.service.custom.useApiGatewayIAMAuthForLambdaFunctions;

    this.serverless.service.getAllFunctions().forEach((functionName) => {
      const functionObject = this.serverless.service.functions[functionName];

      functionObject.events.forEach(event => {
        if (!event.http) { return; }
        if (event.http.useIAMAuth || event.http.invokeWithCallerCredentials) {
          let path;
          let method;

          if (typeof event.http === 'object') {
            path = event.http.path;
            method = event.http.method;
          } else if (typeof event.http === 'string') {
            path = event.http.split(' ')[1];
            method = event.http.split(' ')[0];
          }

          const resourcesArray = path.split('/');
          // resource name is the last element in the endpoint. It's not unique.
          const resourceName = path.split('/')[path.split('/').length - 1];
          const normalizedResourceName = resourcesArray.map(this._capitalizeAlphaNumericPath).join('');
          const normalizedMethod = method[0].toUpperCase() + method.substr(1).toLowerCase();
          // const resourceLogicalId = `ApiGatewayResource${normalizedResourceName}`;
          const methodName = `ApiGatewayMethod${normalizedResourceName}${normalizedMethod}`;

          if (event.http.useIAMAuth) {
            resources[methodName].Properties.AuthorizationType = 'AWS_IAM';
          }

          if (event.http.invokeWithCallerCredentials) {
            resources[methodName].Properties.Integration.Credentials = 'arn:aws:iam::*:user/*';
          }
        }
      });
    });
  }
}

module.exports = ServerlessApiGatewayAuthPlugin;
