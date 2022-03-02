var client = "web";
// 文档加载完毕后执行
$(document).ready(function ()
{
    //根据屏幕大小判定是移动端还是桌面
    const oHtml = document.getElementsByTagName('html')[0]
    const width = oHtml.clientWidth;
    if(width<800){
       client = "wap";
    }
    var args = getQuery();//获取参数
    var id = args["id"]?args["id"]:0;//将要跳转到的文章id。如果没有则直接跳转到首页
    if(!id || id ==0){
        window.location.href = "index.html";
    }

    //跳转到内容页面：需要附加当前用户的fromUser、fromBroker、nickname信息
    jump(id);
});

util.getUserInfo();//从本地加载cookie
util.getBrokerInfo();//从本地加载cookie

function jump(id){//获取详细内容
    var targetUrl = app.config.mp_api+"/archives/"+id;
    //获取本地UserInfo
    if( app.globalData.userInfo &&  app.globalData.userInfo._key){
        targetUrl += "?fromUser="+app.globalData.userInfo._key;
        if(app.globalData.userInfo.nickname && app.globalData.userInfo.nickname.trim().length>0){
            targetUrl += "&fromUsername="+app.globalData.userInfo.nickname.trim();
        }
        if( app.globalData.brokerInfo &&  app.globalData.brokerInfo.id){
            targetUrl += "?fromBroker="+app.globalData.brokerInfo.id;
        }else{//根据openId查询broker信息
            var broker = {};
            console.log("\n===try to query broker from server. ===\n");
            $.ajax({
                url:app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+app.globalData.userInfo._key,
                type:"get",       
                async:false,//同步调用
                success:function(res){
                    console.log("\n=== got broker info. ===\n",res);
                    if (res.status) {
                        broker = res.data;          
                    }
                }
            }); 
            if(broker.id){
                targetUrl += "?fromBroker="+app.globalData.brokerInfo.id;
            }
        }        
    }
    window.location.href = targetUrl;
}

