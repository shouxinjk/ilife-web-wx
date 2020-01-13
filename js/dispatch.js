// 文档加载完毕后执行
$(document).ready(function ()
{
    //从菜单进入微信会传入code和state参数。
    var args = getQuery();//获取参数
    console.log("Dispatch::onReady get parameters.",args);
    code = args["code"]?args["code"]:null; //默认为空，表示错误
    state = args["state"]?args["state"]:"index"; //默认为index
    //
    flightCheck(code,state);
});

var code  = null; //默认为空
var state = "index"; //默认跳转到index页面

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
            //window.location.href=state+".html";
            if(state.indexOf("___")>=0){//如果是跳转到详情页面或列表页面则需要重新组织参数
                var itemUrlArr = state.split("___");//使用___分解页面地址和具体参数
                var targetUrl = itemUrlArr[0] +".html?"+ itemUrlArr[1].replace(/__/g,"&");
                console.log("Dispatch::flightCheck try to redirect to landing page after login.",targetUrl);
                window.location.href=targetUrl;
            }else{
                window.location.href=state+".html";
            }            
        });
    //}   
}

