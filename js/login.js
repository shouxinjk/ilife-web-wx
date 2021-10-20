/**
显示微信登录二维码
**/
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

    //监听父窗口postmessage
    listenPostMessage();

    //checkUserBinding();
    window.parent.postMessage({
      sxCookie:{
        action:"get",
        key:"sxAuth"
      }
    }, "*");//向父窗口发出消息，查询sxAuth

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

                //$.cookie('sxAuth', JSON.stringify(sxAuth), { expires: 3650, path: '/' });   
                //localStorage.setItem('sxAuth', JSON.stringify(sxAuth));          

                //发送通知消息，切换页面：添加随机数，确保每次刷新
                var msg = {
                  sxNavigateTo:"https://www.biglistoflittlethings.com/ilife-web-wx/index_mp.html?from=mp-orgnization&fromUser="+res.openid+"&nonce="+new Date().getTime()
                };
                console.log("post message to redirect to index page.",sxAuth,msg);
                window.parent.postMessage(msg, "*");//不设定origin，直接通过属性区分               
            }
        }
    });
}

//检查是否已经绑定公众号账户
//等待父窗口返回后调用
//sxAuth:{ready:true,openid:openid}
function checkUserBinding(sxAuth){
    console.log("get sxAuth info from sxCookie.",sxAuth);
    if(sxAuth.ready&&sxAuth.openid){//已经绑定，直接跳转
      //通知跳转到列表
      var msg = {
        sxNavigateTo:"https://www.biglistoflittlethings.com/ilife-web-wx/index_mp.html?from=mp-orgnization&fromUser="+sxAuth.openid
      };
      console.log("post message.sxAuth cookie.",sxAuth,msg);
      window.parent.postMessage(msg, "*");//不设定origin，直接通过属性区分   
    }else{//直接显示二维码重新扫，包括扫码过期的情况
      console.log("cannot find openid from cookie. please rescan because cookie missing.",sxAuth);
      showWxQrcode();
    } 
}


//监听postMessage事件
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
            if (sxCookie.action == 'return' && sxCookie.key== 'sxAuth'){
                //接收到父窗口返回的缓存值
                checkUserBinding(sxCookie.value);
            };
        }
    },false);
}


