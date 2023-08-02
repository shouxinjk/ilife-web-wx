// 文档加载完毕后执行
$(document).ready(function ()
{
    //根据屏幕大小计算字体大小
    const oHtml = document.getElementsByTagName('html')[0]
    const width = oHtml.clientWidth;
    var rootFontSize = 12 * (width / 1440);// 在1440px的屏幕基准像素为12px
    rootFontSize = rootFontSize <8 ? 8:rootFontSize;//最小为8px
    rootFontSize = rootFontSize >16 ? 16:rootFontSize;//最大为18px
    oHtml.style.fontSize = rootFontSize+ "px";
    var args = getQuery();//获取参数
    from = args["from"]?args["from"]:"mp";//来源于选品工具，包括公众号流量主、知乎、头条、简书等
    fromUser = args["fromUser"]?args["fromUser"]:"";//从连接中获取分享用户ID

    if(_sxdebug)console.log("got params from & fromUser from query.",from,fromUser);

    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });  

    //监听父窗口postmessage
    listenPostMessage();

    //检查toolbar状态
    checkToolbarStatus();

    //加载用户信息，同时会加载达人信息
    loadUserInfoByOpenid(fromUser);  

    //settings:注册设置事件
    $("#submitFormBtn").click(function(){
        submitItemForm();
    });    

    //默认显示知识库界面：
    $(".sxTabDiv").css("display","none");
    $("#kbdiv").css("display","block");
    //切换面板控制
    $(".sxTab").click(function(){
        $(".sxTabDiv").css("display","none");
        $("#"+$(this).data("div")).css("display","block");
    }); 

     //chatgpt：注册事件：发送prompt
    $("#btnSendPrompt").click(function(){
        sendPrompt();
    });
    //显示第一条对话
    showCompletionProgress();
    showCompletion("我是ChatGPT，可以代写文案回复客户~~");     
 
});

//调试标志
var _sxdebug = false;

//记录分享用户、分享达人
var from = "orgnization";//数据来源，默认为机构达人
var fromUser = "";

//使用代理避免跨域问题。后端将代理到指定的URL地址。使用https
var imgPrefix = "https://www.biglistoflittlethings.com/3rdparty?url=";

util.getUserInfo();//从本地加载cookie

var broker = {
  id:"77276df7ae5c4058b3dfee29f43a3d3b"
};

var columnWidth = 450;//默认宽度300px
var columnMargin = 5;//默认留白5px

var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];//所有内容列表，用于显示历史列表

//直接读取用户信息
function loadUserInfoByOpenid(openid){
  util.checkPerson({openId:openid},function(res){
    app.globalData.userInfo = res;//直接从请求获取信息
    loadBrokerInfoByOpenid(openid);//用户加载后再加载达人信息
    //loadPersons();//用户加载后加载关联用户及客群
    //更新broker头像及名称
    //注意有同源问题，通过postMessage完成
    var brokerMessage = {
      sxBrokerLogo:app.globalData.userInfo.avatarUrl,
      sxBrokerName:app.globalData.userInfo.nickName
    };
    window.parent.postMessage(brokerMessage, "*");//不设定origin，直接通过属性区分
    if(_sxdebug)console.log("post broker message.",brokerMessage);
  });
}

//直接读取达人信息
function loadBrokerInfoByOpenid(openid){
  util.checkBroker(openid,function(res){
    //broker = util.getBrokerInfo();
    broker = res.data;//直接从请求获取信息

    //直接写入cookie，避免同源问题
    document.cookie = "sxBrokerInfo="+JSON.stringify(res.data)+"; SameSite=None; Secure";
    document.cookie = "hasBrokerInfo="+res.status+"; SameSite=None; Secure";

    //TODO：在加载达人后再加载数据，避免brokerInfo缺失
    //startQueryDataLoop();

    //更新broker头像及名称
    //注意有同源问题，通过postMessage完成
    var brokerMessage = {
      sxBrokerLogo:app.globalData.userInfo.avatarUrl,
      sxBrokerName:app.globalData.userInfo.nickName,     
      sxBrokerOrgnization:broker.orgnization.name,   
      sxBrokerRealName:broker.name
    };
    window.parent.postMessage(brokerMessage, "*");//不设定origin，直接通过属性区分
    if(_sxdebug)console.log("post broker message.",brokerMessage);
  });
}


////////chatgpt////////////////////
var chatgptDivId = "#chatgptMsgsDiv";
//用户输入内容模板：气泡在左侧，头像在右侧
var promptTpl=`
    <div style="display:flex;flex-direction:row;width:100%;margin-bottom:8px;">
        <div style="width:12%">
            <img src="__avatar" style="width:80%;object-fit:cover;border-radius:3px;margin-left:5px;"/>
        </div>    
        <div style="width:88%;">      
            __prompt 
        </div>       
    </div>
`;
//ChatGPT回复内容模板：头像在左侧，气泡在由侧
var completionTpl=`
    <div style="display:flex;flex-direction:row;width:100%;margin-left:2%;margin-bottom:8px;">
        <div style="width:12%">
            <img src="images/avatar/chatgpt.jpeg" style="width:80%;object-fit:cover;border-radius:3px;"/>
        </div>    
        <div id="completion__uuid"  style="width:88%;background-color:#ddd;">       
        </div>            
    </div>
`;
//显示prompt：将用户输入的prompt显示到界面
function showPrompt(text){
    var html = promptTpl.replace(/__avatar/g,app.globalData.userInfo.avatarUrl).replace(/__prompt/g,text);
    $(chatgptDivId).append(html); 
    var scrollHeight = $(chatgptDivId).prop("scrollHeight");
    $('#Center').scrollTop(scrollHeight,200);
}
//显示completion：将ChatGPT的回复显示到界面
var pendingCompletionUUID = null;
function showCompletionProgress(){
    pendingCompletionUUID = getUUID();
    var html = completionTpl.replace(/__uuid/g,pendingCompletionUUID);
    $(chatgptDivId).append(html);    
    $("#completion"+pendingCompletionUUID).append("<img src='images/loading.gif'/>");//显示提示图标
    var scrollHeight = $(chatgptDivId).prop("scrollHeight");
    $(chatgptDivId).scrollTop(scrollHeight,200);    
}
function showCompletion(text){
    $("#completion"+pendingCompletionUUID).empty();//清空进度显示
    $("#completion"+pendingCompletionUUID).append(text);//显示得到的文字
    pendingCompletionUUID = null;
    var scrollHeight = $(chatgptDivId).prop("scrollHeight");
    $(chatgptDivId).scrollTop(scrollHeight,200);    
}

//检查并发送prompt到后端请求应答
function sendPrompt(){
    //检查是否完成授权
    if(!broker || !broker.nickname){
        siiimpleToast.message('需要注册后才能使用~~',{
              position: 'bottom|center'
            });         
        return;        
    }    
    //检查是否还有回复在等待
    if(pendingCompletionUUID){
        siiimpleToast.message('还在回答上一个问题哦，稍等哈~~',{
              position: 'bottom|center'
            });         
        return;
    }
    //检查是否有输入文字
    var prompt = $("#promptBox").val();
    if(!prompt || prompt.trim().length==0){
        siiimpleToast.message('说点什么吧~~',{
              position: 'bottom|center'
            });         
        return;        
    }
    //显示到界面
    showPrompt(prompt.trim());
    showCompletionProgress();
    $("#promptBox").val("");
    //发送请求并等待回复
    console.log("try to register broker.");
    $.ajax({
        url:app.config.sx_api+"/rest/api/chatgpt",
        type:"post",
        data:JSON.stringify({
            prompt: prompt.trim(),
            broker:{
                id: broker.id
            },
            openid: app.globalData.userInfo._key
        }),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },
        timeout: 120000,//设置超时时间为120s
        success:function(res){
            console.log("got answer.",res);
            showCompletion(res.text.replace(/\n/g,"<br/>"));
        },
        error:function(){
            console.log("chatgpt failed.");
            showCompletion("🤯🤯ChatGPT抱怨问题有点多，请稍等再体验哦~~");            
        },
        complete:function(XHR,TextStatus){
            if(TextStatus=='timeout'){ //超时执行的程序
                console.log("chatgpt timeout.");
                showCompletion("😴😴问题有点多，排队有点久，换一个试试吧~~"); 
            }
        }
    });     
}

//检查工具面板显示状态
function checkToolbarStatus(){
    if(_sxdebug)console.log("try to check toolbar status..."); 
    var sxToolbarStatus = {};
    if($.cookie('sxToolbarStatus') && $.cookie('sxToolbarStatus').trim().length>0){
        sxToolbarStatus = JSON.parse($.cookie('sxToolbarStatus') );
    } 
    if(_sxdebug)console.log("try to post toolbar  status to parent document.",sxToolbarStatus);   
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
    if(_sxdebug)console.log("child window start listening....");
    var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
    var eventer = window[eventMethod];
    var messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";

    // Listen to message from child window
    eventer(messageEvent,function(e) {
        var key = e.message ? "message" : "data";
        var data = e[key];
        if(_sxdebug)console.log("got message from parent window.",data);
        if(data&&data.sxCookie){//实现缓存数据交换
            var sxCookie  = data.sxCookie;
            if (sxCookie.action == 'set'){//存数据到cookie
                //直接写入cookie：键值包括sxToolbarStatus
                if(_sxdebug)console.log("save cookie",sxCookie);
                document.cookie = sxCookie.key+"="+JSON.stringify(sxCookie.value)+"; SameSite=None; Secure";
                //由于窗口显示变化，需要设置是否加载数据标志
                if(sxCookie.key == 'sxToolbarStatus'){//根据状态设置是否加载数据
                  if(sxCookie.value.show){//展示面板，则设置数据等待加载
                      loading = false;
                  }else{
                      loading = true;
                  }
                }
            }else if (sxCookie.action == 'get') {//从cookie读取数据并返回上层窗口
                if(_sxdebug)console.log("try to post message to parent document.",data);
                window.parent.postMessage({
                    sxCookie:{
                        action: 'return',
                        key:sxCookie.key,
                        value:$.cookie(sxCookie.key)?JSON.parse($.cookie(sxCookie.key)):{}
                        //value:window.localStorage.getItem(sxCookie.key)?JSON.parse(window.localStorage.getItem(sxCookie.key)):{}
                    }
                }, '*');
            }else if (sxCookie.action == 'save') {//存储数据到sxPendingItem
                if(_sxdebug)console.log("try to save data to cookie.",sxCookie);
                if(sxCookie.key == 'sxPendingItem'){
                    if(_sxdebug)console.log("check sxPendingItem exists.",sxCookie.value);
                    /**
                    //从cookie获取已有数据
                    var pendingItems = [];//默认为空数组
                    if($.cookie('sxPendingItem') && $.cookie('sxPendingItem').trim().length>2 ){
                        pendingItems = JSON.parse($.cookie('sxPendingItem'));
                    }

                    //检查是否已经在队列里
                    var index = items.findIndex(item => {
                        return item._key == sxCookie.value._key;
                    });
                                        //**/

                    //如果已经存在则直接忽略
                    //if(index<0){//如果不存在则加入队列
                        //pendingItems.push(sxCookie.value);
                        //items.push(sxCookie.value);//加入当前队列中
                        //loading=false;//继续加载

                        //直接用最新数据更换缓存内容
                        currentItem = sxCookie.value;
                        //写入cookie：注意：cookie尺寸很只有4096字节，仅存储最后一个
                        if(_sxdebug)console.log("save sxPendingItem to cookie.",sxCookie.value);
                        document.cookie = "sxPendingItem="+JSON.stringify(sxCookie.value)+"; SameSite=None; Secure";  
                        //显示到界面，注意只需要加载一次即可                        
                        if(!isCollected){//仅展示一次
                            loadItem(hex_md5(currentItem.url));//默认认为是新采集的条目，生成新的key
                            isCollected = true;
                        }

              
                    //}
                }
            };
        }
    },false);
}

