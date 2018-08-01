/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
var builder_cognitiveservices = require("botbuilder-cognitiveservices");
var SearchLibrary = require('./SearchDialogLibrary');
var AzureSearch = require('./SearchProviders/azure-search');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());



/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);
var inMemoryStorage = new builder.MemoryBotStorage();
var flag = 0;


// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector);
// bot.set('storage', tableStorage);
bot.set('storage', inMemoryStorage);

// Recognizer and and Dialog for preview QnAMaker service
var previewRecognizer = new builder_cognitiveservices.QnAMakerRecognizer({
    // knowledgeBaseId: process.env.QnAKnowledgebaseId,
    // authKey: process.env.QnAAuthKey || process.env.QnASubscriptionKey
    knowledgeBaseId: '02ebdb19-f395-4c30-90b4-552b07ec73ca',
    authKey: 'EndpointKey 1c21189c-b265-4e8c-8cc2-d2b009c6457e' || 'c383e1bb933a494aadb89dfa66fe0588', // Backward compatibility with QnAMaker (Preview)
});

var basicQnAMakerPreviewDialog = new builder_cognitiveservices.QnAMakerDialog({
    recognizers: [previewRecognizer],
    defaultMessage: 'Não sei a resposta para isso ainda. Tente de outra maneira.',
    qnaThreshold: 0.3
}
);

bot.dialog('basicQnAMakerPreviewDialog', basicQnAMakerPreviewDialog);

// Recognizer and and Dialog for GA QnAMaker service
var recognizer = new builder_cognitiveservices.QnAMakerRecognizer({
    // knowledgeBaseId: process.env.QnAKnowledgebaseId,
    // authKey: process.env.QnAAuthKey || process.env.QnASubscriptionKey, // Backward compatibility with QnAMaker (Preview)
    // endpointHostName: process.env.QnAEndpointHostName

    knowledgeBaseId: '02ebdb19-f395-4c30-90b4-552b07ec73ca',
    authKey: 'EndpointKey 1c21189c-b265-4e8c-8cc2-d2b009c6457e' || 'c383e1bb933a494aadb89dfa66fe0588', // Backward compatibility with QnAMaker (Preview)
    endpointHostName: 'https://qnafabrica.azurewebsites.net/qnamaker'
});

var basicQnAMakerDialog = new builder_cognitiveservices.QnAMakerDialog({
    recognizers: [recognizer],
    defaultMessage: 'Não sei a resposta para isso ainda. Tente de outra maneira.',
    qnaThreshold: 0.3
});

bot.dialog('/greetings', [
    function (session) {
        var message = 'Oi, eu sou o BrotherBot, estou aqui para te ajudar a conseguir informações.';
        session.send(message);
        message = 'Qual seu nome?'
        builder.Prompts.text(session, message);
        flag = 1;
    },
    function (session, results) {
        session.endDialog(`Olá, ${results.response}! Pode fazer sua pergunta.`);
    }
]);


function startProactiveDialog(address) {
    bot.beginDialog(address, "*:/greetings");

}

bot.dialog('/', function (session, args) {
    if (flag === 0) {
        console.log('To dentro');
        savedAddress = session.message.address;
        startProactiveDialog(savedAddress);
    } else {
        console.log('Chamando qna');
        session.beginDialog('QnAMakerDialog');
    }
});

bot.dialog('basicQnAMakerDialog', basicQnAMakerDialog);

bot.dialog('QnAMakerDialog', //basicQnAMakerDialog);
    function (session) {
        // var qnaKnowledgebaseId = process.env.QnAKnowledgebaseId;
        // var qnaAuthKey = process.env.QnAAuthKey || process.env.QnASubscriptionKey;
        // var endpointHostName = process.env.QnAEndpointHostName;
        var qnaKnowledgebaseId = '02ebdb19-f395-4c30-90b4-552b07ec73ca';
        var qnaAuthKey = 'EndpointKey 1c21189c-b265-4e8c-8cc2-d2b009c6457e' || 'c383e1bb933a494aadb89dfa66fe0588';
        var endpointHostName = 'https://qnafabrica.azurewebsites.net/qnamaker';

        // QnA Subscription Key and KnowledgeBase Id null verification
        if ((qnaAuthKey == null || qnaAuthKey == '') || (qnaKnowledgebaseId == null || qnaKnowledgebaseId == ''))
            session.send('Please set QnAKnowledgebaseId, QnAAuthKey and QnAEndpointHostName (if applicable) in App Settings. Learn how to get them at https://aka.ms/qnaabssetup.');
        else {
            if (endpointHostName == null || endpointHostName == '')
                // Replace with Preview QnAMakerDialog service
                session.replaceDialog('basicQnAMakerPreviewDialog');
            else
                // Replace with GA QnAMakerDialog service
                session.replaceDialog('basicQnAMakerDialog');
        }
    });

/* // Azure Search provider
var azureSearchClient = AzureSearch.create('qnafabrica-asv6uw2veotpxvm', '319E59B619DD5E4A6450B55FFC4F1A45', 'botfabrica');
var ResultsMapper = SearchLibrary.defaultResultsMapper(ToSearchHit);

// Register Search Dialogs Library with bot
bot.library(SearchLibrary.create({
    multipleSelection: true,
    search: function (query) { return azureSearchClient.search(query).then(ResultsMapper); },
    refiners: ['Definição', 'Teste'],
    refineFormatter: function (refiners) {
        return _.zipObject(
            refiners.map(function (r) { return 'By ' + _.capitalize(r); }),
            refiners);
    }
}));

// Maps the AzureSearch Job Document into a SearchHit that the Search Library can use
function ToSearchHit(azureResponse) {
    return {
        // define your own parameters 
        key: azureResponse.id,
        title: azureResponse.title,
        description: azureResponse.description,
        imageUrl: azureResponse.thumbnail
    };
} */