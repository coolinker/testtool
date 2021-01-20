const colors = require('colors/safe');

const deltaConsole = require('jsondiffpatch').console;
const jsondiffpatch = require('jsondiffpatch').create();
const jsondiffpatchFilter = require('jsondiffpatch').create({
    propertyFilter: jsonDiffPropertyFilter
  });

function requestToObj(request) {

    return {
        headers: filterHeaders(request.headers()),
        postData: request.postData(),
        method: request.method(),
        url: request.url(),
    }
}
  
function filterHeaders(headers) {
    delete headers["user-agent"];
    return headers;
}

async function getResponseBody(response) {
    const headers = response.headers();
    const status = response.status();
    if (status === 302) return "";

    const contentType = headers["content-type"];
    if (contentType.indexOf("image") > -1) {
        return (await response.buffer()).toString('base64');
    }

    return await response.text();
}

function generateStateDelta(target, source, useFilter = true) {
    const jdp = useFilter ? jsondiffpatchFilter : jsondiffpatch;
    const delta = jdp.diff(source.state, target.state);
    target.delta = delta;
    delete target.state;
}

function jsonDiffPropertyFilter(name, context) {
    try{
        if (name === "type" && context.left?.type?.indexOf("@@redux/INIT") === 0) {
            //console.log(colors.yellow("Filter attributes"), name, context.childName, context.root?.left?.action?.type);
            return false;
        }
        if (name == "$startDate"
            && (context.childName === "$submission" 
            || context.childName === "$poll"
            || context.parent.childName === "$poll"
            || context.parent.childName === "$submission")) {
            //console.log(colors.yellow("Filter attributes"), name, context.childName, context.parent?.childName);
            return false;
        }
        if (name == "$width"
        && context.childName === "$env" ) {
            //console.log(colors.yellow("Filter attributes"), name, context.childName);
            return false
        } else if (name === "$width") {
            return false;
        }

        if (name === "ordinal" || name === "shuffleOrder") {
            return false;
        }

    } catch (e) {
        console.log(colors.red(e));
    }
    
    return true;
}

module.exports = {
    requestToObj,
    getResponseBody,
    generateStateDelta,
    deltaConsole,
    jsondiffpatchFilter,
};