// 文档加载完毕后执行
$(document).ready(function ()
{
    //从菜单进入微信会传入code和state参数。
    var args = getQuery();//获取参数
    console.log("Dispatch::onReady get parameters.",args);
    code = args["code"]?args["code"]:null; //默认为空，表示错误
    state = args["state"]?args["state"]:"index"; //默认为index

    flightCheck(code,state);
});

var code  = null; //默认为空
var state = "index"; //默认跳转到index页面

var brokerDefaultTargetUrl = null ;//静默注册达人默认跳转地址。仅对静默注册达人有效，其他地址由菜单指定

function flightCheck(code,state){
    /*
    //避免检查本地缓存，直接通过线上请求。避免导致只获取openid时发生无法登录的情况
    if(util.hasUserInfo()){//如果已存在本地用户，则直接跳转到指定页面
        if(state.indexOf("___")>=0){//如果是跳转到详情页面则需要重新组织参数
            var itemUrlArr = state.split("___");//使用___分解页面地址和具体参数
            var targetUrl = itemUrlArr[0] +".html?"+ itemUrlArr[1].replace(/__/g,"&");
            console.log("Dispatch::flightCheck try to redirect to landing page.",targetUrl);
            window.location.href=targetUrl;
        }else{
            window.location.href=state+".html";
        }
    }else{//否则请求微信UserInfo
    //**/
        util.login(code,function (res) {//成功后创建用户
            console.log("Dispatch::flightCheck login success.", res);
            //设置本地UserInfo：存储到cookie
            $.cookie('sxUserInfo', JSON.stringify(res), { expires: 3650, path: '/' });
            $.cookie('hasUserInfo', 'true', { expires: 3650, path: '/' });
            //根据点击菜单完成静默注册及跳转干预
            //判断规则：如果state包含broker或publisher，则检查本地是否有缓存brokerInfo，如果没有则触发静默注册，并设置跳转地址
            if((state.indexOf("broker")>-1 || state.indexOf("publisher")>-1) || state.indexOf("toys")>-1  || state.indexOf("console")>-1 && (!util.getBrokerInfo() || !util.getBrokerInfo().id)){//本地没有达人信息
                //发起检查及静默注册请求：发起即可，不用等
                util.checkBrokerSilent({
                    openid:res.openid?res.openid:res.openId,
                    nickname:res.nickname?res.nickname:(state.indexOf("broker")>-1?"生活家":"流量主"),
                });
                //修改入口位置
                if(state.indexOf("toys")>-1){
                    brokerDefaultTargetUrl = "toys.html";
                }else{
                    brokerDefaultTargetUrl = "console.html"; //默认进入控制台
                }
            }
            //菜单入口设置：小确幸-->index.html；生活家-->清单(已有达人)、任务(静默注册)；流量主-->文章            
            //window.location.href=state+".html";
            if(state.indexOf("___")>=0){//如果是跳转到详情页面或列表页面则需要重新组织参数
                var itemUrlArr = state.split("___");//使用___分解页面地址和具体参数
                var targetUrl = itemUrlArr[0].replace(/__/g,"/") +".html?"+ itemUrlArr[1].replace(/__/g,"&");//通过state传递参数分为2部分：前部分为页面，后部分为参数。两者通过___分隔。前半部分若有路径/采用__分隔。后半部分有多个参数&采用__分隔
                if(brokerDefaultTargetUrl)targetUrl=brokerDefaultTargetUrl;//如果重置了跳转地址则使用重置URL
                console.log("Dispatch::flightCheck try to redirect to landing page after login.",targetUrl);
                window.location.href=targetUrl;
            }else{
                window.location.href=state.replace(/__/g,"/")+".html";
            }            
        });
    //}   
}

