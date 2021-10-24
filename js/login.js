/**
显示微信登录二维码
**/
var client = "web";
var targetUrl = "https://www.biglistoflittlethings.com/ilife-web-wx/index_mp.html";//支持登录后跳转到多个地址，默认为发布界面
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
    if(args["targetUrl"]){
        targetUrl = decodeURIComponent(args["targetUrl"]);
    }
    console.log("got targetUrl",targetUrl):

    //监听父窗口postmessage
    listenPostMessage();

    //检查账户绑定
    checkUserBinding();

    //检查toolbar状态
    checkToolbarStatus();

});

//请求qrcode并显示二维码，供达人扫码绑定
function showWxQrcode(){
    $.ajax({
        url:"https://data.shouxinjk.net/ilife-wechat/wechat/ilife/bind-qrcode",
        type:"get",
        data:{},
        success:function(res){
            console.log("got qrcode and redirect.",res);
            //显示二维码
            $("#wxQrcodeDiv").html("<img width='240' src='"+res.url+"' style='margin-left:80px;'/>");
            $("#sxName").css("display","block");
            $("#sxTips").css("display","block");
            //开始轮询扫码结果
            //**
            setInterval(function ()
            {
              getQrcodeScanResult(res.ticket);//实际是uuid
            }, 500);
            //**/
        }
    });
}

//查询扫码结果，将返回openid
function getQrcodeScanResult(ticket){
    console.log("try to query scan result by uuid.",ticket);
    $.ajax({
        url:"https://data.shouxinjk.net/ilife-wechat/wechat/ilife/bind-openid?uuid="+ticket,
        type:"get",
        data:{},
        success:function(res){
            console.log("got qrcode scan result.",res);
            if(res.status && res.openid){//成功扫码，将授权信息写入cookie ，并跳转到列表页面
               //写入cookie
               var sxAuth = {
                    ready:true,
                    openid:res.openid
                };

                /**
                //通过postMessage在寄主页面写cookie ：废弃
                console.log("write code and state to cookie.", sxAuth);
                //临时存储已经绑定的openid：注意，因安全策略限制，不能在iframe内直接存储cookie。通过postMessage及localstorge完成
                var msg = {
                  sxCookie:{
                    action:"set",
                    key:"sxAuth",
                    value:sxAuth
                  }
                };
                window.parent.postMessage(msg, "*");//不设定origin，直接通过属性区分
                console.log("post message to parent window.",msg);
                //**/
 
                setSxCookie(sxAuth);        

                //发送通知消息，切换页面：添加随机数，确保每次刷新
                var msg = {
                  sxNavigateTo:targetUrl+"?from=mp-orgnization&fromUser="+res.openid+"&nonce="+new Date().getTime()
                };

                //对于采集器，首次扫码登录后由于数据已经采集发送完成，需要刷新页面再次触发采集
                if(targetUrl.indexOf("index_crawler")>0)//如果目标页面是采集页面
                    msg.sxRefresh = true;

                console.log("post message to redirect to index page.",sxAuth,msg);
                //通过postMessage通知跳转到列表页面
                window.parent.postMessage(msg, "*");//不设定origin，直接通过属性区分    
                //**/           
            }
        }
    });
}

//检查是否已经绑定公众号账户
//等待父窗口返回后调用
//sxAuth:{ready:true,openid:openid}
function checkUserBinding(){
    var sxAuth = getSxCookie();
    console.log("get sxAuth info from sxCookie.",sxAuth);
    if(sxAuth && sxAuth.ready && sxAuth.openid){//已经绑定，直接跳转
      //通知跳转到列表
      var msg = {
        sxNavigateTo:targetUrl+"?from=mp-orgnization&fromUser="+sxAuth.openid+"&nonce="+new Date().getTime()
      };
      console.log("post message.sxAuth cookie.",sxAuth,msg);
      window.parent.postMessage(msg, "*");//不设定origin，直接通过属性区分   
    }else{//直接显示二维码重新扫，包括扫码过期的情况
      console.log("cannot find openid from cookie. please rescan because cookie missing.",sxAuth);
      showWxQrcode();
    } 
}

//检查工具面板显示状态
function checkToolbarStatus(){
    console.log("try to check toolbar status..."); 
    var sxToolbarStatus = {};
    if($.cookie('sxToolbarStatus') && $.cookie('sxToolbarStatus').trim().length>0){
        sxToolbarStatus = JSON.parse($.cookie('sxToolbarStatus') );
    } 
    console.log("try to post toolbar  status to parent document.",sxToolbarStatus);   
    window.parent.postMessage({
        sxCookie:{
            action: 'return',
            key:'sxToolbarStatus',
            value:sxToolbarStatus
        }
    }, '*');    
}


//监听postMessage事件：在工具条发生变化时，将状态写入cookie
function listenPostMessage(){
    var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
    var eventer = window[eventMethod];
    var messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";

    // Listen to message from child window
    eventer(messageEvent,function(e) {
        var key = e.message ? "message" : "data";
        var data = e[key];
        console.log("got message",data);
        if(data&&data.sxCookie){//实现缓存数据交换
            var sxCookie  = data.sxCookie;
            if (sxCookie.action == 'set'){//存数据到cookie
                //直接写入cookie：键值包括sxToolbarStatus
                console.log("save cookie",sxCookie);
                document.cookie = sxCookie.key+"="+JSON.stringify(sxCookie.value)+"; SameSite=None; Secure";
                //接收到父窗口返回的缓存值
                //checkUserBinding(sxCookie.value);
            }else if (sxCookie.action == 'get') {//从cookie读取数据并返回上层窗口
                console.log("try to post message to parent document.",data);
                window.parent.postMessage({
                    sxCookie:{
                        action: 'return',
                        key:sxCookie.key,
                        value:$.cookie(sxCookie.key)?JSON.parse($.cookie(sxCookie.key)):{}
                        //value:window.localStorage.getItem(sxCookie.key)?JSON.parse(window.localStorage.getItem(sxCookie.key)):{}
                    }
                }, '*');
            };
        }
    },false);
}

//获取cookie
function getSxCookie(){
    var sxAuthInfo = $.cookie('sxAuth');
    var sxAuth = {};
    if(sxAuthInfo && sxAuthInfo.trim().length>0){
        sxAuth = JSON.parse(sxAuthInfo);
    }
    console.log("get sxAuth from cookie.",sxAuth);   
    return sxAuth;
}

//写入cookie
function setSxCookie(sxAuth){
    console.log("write sxAuth to cookie.",sxAuth);   
    //$.cookie('sxAuth', JSON.stringify(sxAuth), { expires: 3650, path: '/' });
    //支持cookie存取
    document.cookie = "sxAuth="+JSON.stringify(sxAuth)+"; SameSite=None; Secure";
}


