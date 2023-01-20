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

    $('#waterfall').NewWaterfall({
        width: columnWidth,
        delay: 100,
    });

    //加载指南类型
    loadGuideTypes();

    //显示加载状态
    showloading(true);

    //显示加载状态
    //showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    if(args["from"]){
        from = args["from"]; //需要修改的用户ID
    }    

    if(args["type"]){
        guideType = args["type"]; //类型：free、guide
    }  
    if(args["status"]){
        guideStatus = args["status"]; //状态
    }     

    if(args["categoryId"]){
        categoryId = args["categoryId"]; //预留
    }    

    $("body").css("background-color","#fff");//更改body背景为白色

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });      
    //loadPerson(currentPersonId);//加载需要修改的用户信息

    //加载列表
    registerTimer();

});

util.getUserInfo();//从本地加载cookie

var columnWidth = 800;//默认宽度600px
var columnMargin = 5;//默认留白5px
var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];//所有画像列表
var page = {
    size:10,//每页条数
    total:1,//总页数
    current:-1//当前翻页
};

var currentActionType = '';//当前操作类型
var tagging = '';//操作对应的action 如buy view like 等

var from = "my";//可选值为my/connections,默认认为是自己修改自己

var currentPersonId = app.globalData.userInfo?app.globalData.userInfo._key:null;//默认为当前登录用户
var userInfo=app.globalData.userInfo;//默认为当前用户

var currentPersonaId = null;
var currentPersona = {};
var currentConnection = null;

var categoryId = null;
var categoryName = null;

var guideType = null;//接收参数：根据类型过滤
var guideStatus = null;//接收参数：根据状态过滤

var currentPerson = {};//默认当前修改用户为空

var sxTimer = null;
var sxStartTimestamp=new Date().getTime();//定时器如果超过2分
var sxLoopCount = 1000;//定时器运行100次即停止，即30秒

//装载需要类型
var guideTypes = {};//记录指南类型
function loadGuideTypes(){
    util.AJAX(app.config.sx_api+"/sys/dict/rest/byType", function (res) {
        showloading(false);
        console.log("loadDicts try to retrive pending items.", res)
        if (res && res.length>0) {//加载类型列表
            res.forEach(function(item){
                guideTypes[item.value]=item.label;                          
            });         
        }else{//如果没有则提示，
            console.log("cannot load ditc by type: guide_type ");           
        }
    }, 
    "GET",
    {type:"guide_type"},
    {});
}

function registerTimer(){
    sxTimer = setInterval(function ()
    {
        if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
        {
            console.log("registerTimer start load items.");
            // 表示开始加载
            loading = true;
            showloading(true);

            // 加载内容
            if(items.length < num){//如果内容未获取到本地则继续获取
                console.log("request pending values from server side.");
                //读取待标注列表
                loadItems();
                //有用户操作则恢复计数器
                console.log("reset loop count.");
                sxLoopCount = 100;                
            }else{//否则使用本地内容填充
                console.log("insert item from locale.");
                insertItem();
            }
        }

        //计数器自减，到时即停止
        /**
        if(--sxLoopCount<0){
            unregisterTimer();
        }
        //**/
    }, 300);
}

function unregisterTimer(){
    console.log("clear timer.");
    clearInterval(sxTimer);
}

function loadItems(){
    util.AJAX(app.config.sx_api+"/diy/guideBook/rest/guide-books", function (res) {
        showloading(false);
        console.log("loadItems try to retrive pending items.", res)
        if (res && res.length>0 ) {//否则显示到页面
            //更新当前翻页
            page.current = page.current + 1;
            //装载到列表
            res.forEach(function(item){
                if(items.find(entry => entry.id == item.id)){ //排重
                    //do nothing
                }else{
                    items.push(item);
                }
            });          
            //显示到页面
            insertItem();
        }else{//如果没有则提示，
            shownomore();
            if(!items || items.length==0){
                $("#Center").append("<div style='font-size:12px;line-height:24px;width:100%;text-align:center;'>没有定制指南~~</div>");
            }            
        }
    }, 
    "POST",
    {
        type: guideType?guideType:"",
        status: guideStatus?guideStatus:"",
        page: {
            pageNo:page.current+1,
            pageSize:page.size            
        }
    },
    {
        "Content-Type":"application/json",
        "Accept": "application/json"        
    });
}

//将item显示到页面
function insertItem(){
    // 加载内容
    var item = items[num-1];
    if(!item){
        shownomore(true);
        return;
    }

    var image = "<img src='images/guide/"+item.type+".png' width='48px' height='48px' style='object-fit:cover;' />"
    var tagTmpl = "<div class='persona-tag' style='background-color:__bgcolor;border-color:__bgcolor;border-radius:12px;padding:1px 5px;'>__TAG</div>";
    var tags = "<div class='persona-tags'>";
    //来源
    if(item.origin && item.origin.trim().length>0)
        tags += tagTmpl.replace(/__bgcolor/g,"#514c49").replace(/__TAG/g,item.origin.trim());    
    //类型
    if(guideTypes[item.type])
        tags += tagTmpl.replace(/__bgcolor/g,"#514c49").replace(/__TAG/g,guideTypes[item.type]);  
    tags += "</div>";

    //显示高亮标签，包括类型、状态。采用固定样式结构
    var highlightTagTpl = "<span class='profitTip__csstype'>__type</span><span class='itemTagProfit__csstype'>__tag</span>&nbsp;"
    var highlights = "<div style='margin:5px 0;margin-top:-10px;'>";
    //状态：
    if(item.status==0){
        highlights += highlightTagTpl.replace(/__csstype/g,"Order").replace(/__type/g,"状态").replace(/__tag/g,"未启用");
    }else{
        highlights += highlightTagTpl.replace(/__csstype/g,"Team").replace(/__type/g,"状态").replace(/__tag/g,"已启用");
    }
    highlights += "</div>";


    var alias = "";
    if(item.alias && item.alias.trim().length>0){
        alias = "("+item.alias.trim()+")";
    }
    var revision = "";
    if(item.revision && item.revision.trim().length>0){
        revision = " 版本:"+item.revision;
    }
    var url = "";
    if(item.url && item.url.indexOf("http")==0){
        url = "&nbsp;<a href='"+item.url+"' style='font-size:12px;font-weight:bold;'>查看</a>";
    }
    var title = "<div class='persona-title'>"+item.name+alias+revision+url+"</div>"
    var description = "<div class='persona-description'>"+item.description+"</div>"   

  
    $("#waterfall").append("<li><div class='sx_seperator' style='margin:10px 0;width:90%;margin-left:5%;'></div><div class='persona' id='"+item.id+"' style='border:0;'><div class='persona-logo-wrapper'>" + image +"</div><div class='persona-info'>" +title+highlights +description+ tags+ "</div><div class='persona-action'></div></li>");
    num++;

    //注册事件： 查看指南详情
    /**
    $("#"+item.id).click(function(){
        window.location.href="proposal-guide.html?id="+$(this).attr("id");
    });
    //**/

    // 表示加载结束
    loading = false;
}


//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        //userInfo = res;
        currentPerson = res;
        //检查是否有persona设置，如果没有则跳转到persona选择界面
        if((res.persona && res.persona._key) || !res.openId){//如果有persona则显示表单。注意：对于通过画像生成虚拟用户则直接显示表单，通过有无openId判断
            insertPerson(userInfo);//TODO:当前直接显示默认信息，需要改进为显示broker信息，包括等级、个性化logo等
            showPerson(currentPerson);//显示设置的用户表单
            loadBrokerByOpenid(userInfo._key);//根据当前登录用户openid加载broker信息
        }else{//没有persona则提示先选择一个persona
            window.location.href = "user-choosepersona.html?id="+personId+"&refer=user";//refer=user表示设置后返回到user界面
        }
    });
}

//更新Broker
function updateBroker(broker) {
    console.log("try to update broker.[broker]",broker);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/"+broker.id, function (res) {
        console.log("update broker successfully.",res);
    },"PUT",broker,{ "Content-Type":"application/json" });
}

//根据openid查询加载broker
function loadBrokerByOpenid(openid) {
    console.log("try to load broker info by openid.[openid]",openid);
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid, function (res) {
        console.log("load broker info.",openid,res);
        if (res.status) {
            insertBroker(res.data);//显示达人信息
        }
    });
}

//显示没有更多内容
function shownomore(flag){
  if(flag){
    $("#footer").toggleClass("footer-hide",false);
    $("#footer").toggleClass("footer-show",true);
  }else{
    $("#footer").toggleClass("footer-hide",true);
    $("#footer").toggleClass("footer-show",false);
  }
}

//显示正在加载提示
function showloading(flag){
  if(flag){
    $("#loading").toggleClass("loading-hide",false);
    $("#loading").toggleClass("loading-show",true);
  }else{
    $("#loading").toggleClass("loading-hide",true);
    $("#loading").toggleClass("loading-show",false);    
  }
}

function changeActionType (e) {
    console.log("now try to change action type.",e);
    //首先清除原来高亮状态
    if(currentActionType.trim().length>0){
        $("#"+currentActionType+" img").attr("src","images/"+currentActionType+".png"); 
        $("#"+currentActionType+" div").removeClass("actiontype-selected");
        $("#"+currentActionType+" div").addClass("actiontype");  
    }  
    //更改并高亮显示
    currentActionType = e.currentTarget.id;
    tagging = e.currentTarget.dataset.tagging;

    if (app.globalData.isDebug) console.log("User::ChangeActionType change action type.",currentActionType,tagging);
    if(currentActionType.trim().length>0){
        $("#"+currentActionType+" img").attr("src","images/"+currentActionType+"-selected.png"); 
        $("#"+currentActionType+" div").removeClass("actiontype");
        $("#"+currentActionType+" div").addClass("actiontype-selected");  
    } 

    var target = e.currentTarget.dataset.target;
    //跳转到相应页面
    if(target && target.trim().length>0 ){
        window.location.href = target;
    }else{
        window.location.href = currentActionType+".html";
    }
    
}


