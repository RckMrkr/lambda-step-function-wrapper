const aws = require('aws-sdk');

const stepfunctions = new aws.StepFunctions();

const getAccessToken = async (shop, connectionPool) => {
    const [rows] = await connectionPool.execute('SELECT token from `access_tokens` where shop = ? LIMIT 1', [shop])
    return (rows && rows[0] && rows[0].token) || null
}



const createApolloClient = async (ApolloImport, connectionPool, shop) => {
    const accessToken = await getAccessToken(shop, connectionPool);

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

class StepFunctionError extends Error {
    constructor(message, data) {
        super(message)
        this.data = data;
    }
}

const stepFunctionWrapper = (main) => {
    return async ({ TaskToken: taskToken, Input: { shop, Cause, ...event } }) => {
        if(Cause){
            shop = JSON.parse(Cause).shop;
        }
        let params = { taskToken };

        try {
            const responseObject = await main(event, shop);
            params.output = JSON.stringify({ ...responseObject, shop })
            await stepfunctions.sendTaskSuccess(params).promise();
        } catch (error) {
            console.error(error);
            if (error instanceof StepFunctionError) {
                params.error = error.data.errorName;
                params.cause = JSON.stringify({shop});
            } else {
                params.error = JSON.stringify(error);
                params.cause = JSON.stringify(error.message);
            }
            await stepfunctions.sendTaskFailure(params).promise();
        }
    };
};

module.exports = {
    stepFunctionWrapper,
    createApolloClient,
    StepFunctionError,
}