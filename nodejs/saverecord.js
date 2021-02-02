const fs = require('fs');
const { generateStateDelta } = require('./utils');

const saveRecords = (caseName = "Case", jsonObj) => {
    const fileName = `${caseName}.json`;
    try {    
        fs.writeFile(fileName, JSON.stringify({
            ...jsonObj,
            REDUX_ACTIONS: minimizeReduxState(jsonObj.REDUX_ACTIONS),
            domMutationTimes: jsonObj.DOM_MUTATIONS.map(d => d.time),
            responsesTimes: jsonObj.RESPONSES.map(d => d.time),
        }), (err) => {
            if (err) {
                console.log("write file error:", err);
                throw err;
            }

            console.log(`Case "${caseName}" written to ${fileName}`);
        });

    } catch (e) {
        console.log(e)
    }
    // fs.writeFile("httpTraffic.json", JSON.stringify({
    //     REQUESTS: jsonObj.REQUESTS,
    //     RESPONSES: jsonObj.RESPONSES,
    // }), (err) => {
    //     if (err) throw err;
    //     console.log(`Case "${caseName}" http traffic written to httpTraffic.json`);
    // });
    // console.log(jsonObj.REQUESTS[0]);
}

const minimizeReduxState = actionMsgs => {
    for (let i = actionMsgs.length - 1; i > 0; i--) {
        const message0 = actionMsgs[i-1].message;
        const message1 = actionMsgs[i].message;
        generateStateDelta(message1, message0, false);
        // const delta = jsondiffpatch.diff(message0.state, message1.state);
        // message1.delta = delta;
        // delete message1.state;
    }
    //actionMsgs[0].message.delta = actionMsgs[0].message.state;
    actionMsgs[0] && generateStateDelta(actionMsgs[0].message, {state: {}}, false);
    //delete actionMsgs[0].message.state;

    return actionMsgs;
}

module.exports = saveRecords;
