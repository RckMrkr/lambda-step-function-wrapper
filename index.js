const aws = require('aws-sdk');
const mysql = require('mysql2/promise');

const stepfunctions = new aws.StepFunctions();

const getAccessToken = async (shop) => {
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOSTNAME,
        password: process.env.MYSQL_PASSWORD,
        user: process.env.MYSQL_USERNAME,
        database: process.env.MYSQL_DATABASE
      });
    const [rows] = await connection.execute('SELECT token from `access_tokens` where shop = ? LIMIT 1', [shop])
    
    return (rows && rows[0] && rows[0].token) || null
}



const createApolloClient = async (ApolloImport, shop) => {
    const accessToken = await getAccessToken(shop);
    
    return new ApolloImport.default({
        uri: `https://${shop}/admin/api/2020-07/graphql.json`,
        request: operation => {
            operation.setContext({
                headers: {
                    "X-Shopify-Access-Token": accessToken
                }
            });
        }
    });
}

const stepFunctionWrapper = (main) => {
  return async ({TaskToken: taskToken, Input: {shop, ...event}}) => {
      let params = { taskToken };
      
      try{
          const responseObject = await main(event, shop);
          params.output = JSON.stringify({...responseObject, shop})
          await stepfunctions.sendTaskSuccess(params).promise();
      } catch(error) {
          console.error(error);
          params.error = JSON.stringify(error);
          params.cause = JSON.stringify(error.message);

          await stepfunctions.sendTaskFailure(params).promise();
      }
  };
};

module.exports = {
    stepFunctionWrapper,
    createApolloClient,
}