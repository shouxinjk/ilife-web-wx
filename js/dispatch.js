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
    if(util.hasUserInfo()){//如果已存在本地用户，则直接跳转到指定页面
        window.location.href=state+".html";
    }else{//否则请求微信UserInfo
        util.login(code,function (res) {//成功后创建用户
            console.log("Dispatch::flightCheck login success.", res);
            //设置本地UserInfo：存储到cookie
            $.cookie('sxUserInfo', JSON.stringify(res), { expires: 3650, path: '/' });
            $.cookie('hasUserInfo', 'true', { expires: 3650, path: '/' });
            window.location.href=state+".html";
        });
    }   
}

