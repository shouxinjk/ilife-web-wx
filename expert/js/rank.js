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

    //处理参数
    var args = getQuery();//获取参数
    if(args["from"]){
        from = args["from"]; //需要修改的用户ID
    }    
    if(args["id"]){
        rankId = args["id"]; //rankId
    } 
    if(args["categoryId"]){
        categoryId = args["categoryId"]; //记录当前修改节点维度
    }    
    if(args["personaId"]){
        currentPersonaId = args["personaId"]; //初次设置时，默认使用persona属性填充
    }

    $("body").css("background-color","#fff");//更改body背景为白色

    //注册事件：新建排行榜
    $("#createRankBtn").click(function(e){
        window.location.href = "../measures.html?categoryId="+categoryId+"&categoryName="+categoryName;
    }); 

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });      
    //loadPerson(currentPersonId);//加载需要修改的用户信息

    //加载排行榜类型字典：支持自动选集及手动选集
    //loadRankTypes();

    //加载列表
    loadItem();

    //注册事件：查看排行榜
    $("#findMoreBtn").click(function(){
        window.location.href = "../billboard.html?rankId="+rankId;
    });

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

var rankId = null;
var rankTypes = {};//指南类型键值对

var currentPerson = {};//默认当前修改用户为空

function loadRankTypes(){
    util.AJAX(app.config.sx_api+"/sys/dict/rest/byType", function (res) {
        showloading(false);
        console.log("loadItems try to retrive pending items.", res)
        if (res && res.length>0) {//加载类型列表
            res.forEach(function(item){
                rankTypes[item.value]=item.label;
            });         
        }else{//如果没有则提示，
            console.log("cannot load ditc by type: rank_type ");           
        }
    }, 
    "GET",
    {type:"rank_type"},
    {});
}

function loadItem(){
    util.AJAX(app.config.sx_api+"/mod/rank/rest/rank/"+rankId, function (res) {
        console.log("got rank.",res);
        if (res.rank) {//有数值时才显示
            //设置categoryId、categoryName，用于新建排行榜
            categoryId = res.rank.category.id;
            categoryName = res.rank.category.name;
            //显示到页面
            insertItem(res.rank,res.items);           
        }else{//如果没有则提示，
            shownomore();
            console.log("cannot find rank by id. ", rankId);           
        }          
    }, 
    "GET",
    {},
    {});
}

//将item显示到页面
var dimensionTpl = `
        <div style='margin:2px 0;width:80%;margin-left:10%;display:flex;flex-direction:row;align-items: center; padding:2px;'>
            <div style="width:20%;">
                <span style="font-size:32px;margin-left:15px;line-height:40px;color:grey;text-align:center;">__number</span>
            </div>
            <div style="width:80%;">
                <div style="text-align:center;font-size:14px;line-height:18px;font-weight:bold;">__title</div>
                <div style="text-align:center;font-size:12px;line-height:16px;">__description</div>
            </div>
        </div>
    `;      
function insertItem(item, rankItems){
    //logo
    var logo = "http://www.shouxinjk.net/static/logo/distributor/ilife.png";
    if(item.category.logo && item.category.logo.indexOf("http")>-1){
        logo = item.category.logo;
    }else if(item.category.logo && item.category.logo.trim().length>0){
        logo = "http://www.shouxinjk.net/static/logo/category/"+item.category.logo;
    }

    var image = "<img src='"+logo+"' width='60px' height='60px' style='object-fit:cover;' />"
    var tagTmpl = "<div class='persona-tag' style='background-color:__bgcolor;border-color:__bgcolor;'>__TAG</div>";
    var tags = "<div class='persona-tags'>";
    //将关键字作为标签
    if(item.keywords && item.keywords.trim().length>0){
        item.keywords.trim().split(" ").forEach(function(keyword){
            if(keyword.trim().length>0)
                tags += tagTmpl.replace(/__bgcolor/g,"#514c49").replace(/__TAG/g,keyword);    
        });
    }
    tags += "</div>";

    //显示高亮标签，包括类型、状态。采用固定样式结构
    var highlightTagTpl = "<span class='profitTipCredit'>__type</span><span class='itemTagProfitCredit'>__tag</span>&nbsp;"
    var highlights = "<div style='margin:5px 0;'>";
    //类目：
    highlights += highlightTagTpl.replace(/__type/g,"类目").replace(/__tag/g,item.category.name);
    highlights += "</div>";

    var goBillboard = "&nbsp;<a href='../billboard.html?rankId="+rankId+"' style='font-size:12px;font-weight:bold;'>查看榜单</a>";

    var title = "<div class='persona-title'>"+item.name+goBillboard+"</div>"
    var description = "<div class='persona-description'>"+item.description+"</div>"  

    $("#base").append("<div class='persona' id='"+item.id+"' style='border:0;'><div class='persona-logo-wrapper' style='width:25%;'>" + image +"</div><div class='persona-info' style='width:75%;'>" +title +highlights+description+ tags+ "</div>");

    //章节列表
    if(rankItems && rankItems.length>0){
        var index = 0;
        rankItems.forEach(function(rankItem){
            var html = "";
            if(index>0)
                html += "<div class='sx_seperator' style='margin:2px 0;width:80%;margin-left:10%;'></div>";
            html += dimensionTpl.replace(/__title/g,rankItem.dimension.name).replace(/__description/g,rankItem.dimension.description).replace(/__number/g,(index+1));
            $("#dimensionItems").append(html);
            index ++;
        });
    }else{
        $("#dimensionTips").css("display","block");
    }

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

    //跳转到相应页面
    window.location.href = currentActionType+".html";
}


