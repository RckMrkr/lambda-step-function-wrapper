const aws = require('aws-sdk');
const stepfunctions = new aws.StepFunctions();

module.exports = (main) => {
  return async ({TaskToken: taskToken, ...event}) => {
      let params = {
          taskToken: taskToken
      };
      
      try{
          params.output = JSON.stringify(await main(event));
          await stepfunctions.sendTaskSuccess(params).promise();
      } catch(error) {
          params.output = error.message;
          await stepfunctions.sendTaskFailure(params).promise();
      }
  };
};