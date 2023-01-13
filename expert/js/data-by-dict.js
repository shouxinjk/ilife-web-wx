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

    //显示加载状态
    showloading(true);

    //显示加载状态
    //showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    if(args["from"]){
        from = args["from"]; //需要修改的用户ID
    }    
    if(args["id"]){
        dictId = args["id"]; //dictId
    } 
    if(args["categoryId"]){
        categoryId = args["categoryId"]; //记录当前修改节点维度
    }    
    if(args["personaId"]){
        currentPersonaId = args["personaId"]; //初次设置时，默认使用persona属性填充
    }

    $("body").css("background-color","#fff");//更改body背景为白色

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });      
    //loadPerson(currentPersonId);//加载需要修改的用户信息

    //加载列表
    loadItems();

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

var dictId = null;

var currentPerson = {};//默认当前修改用户为空

function loadItems(){
    util.AJAX(app.config.sx_api+"/mod/dictValue/rest/values-with-score", function (res) {
        showloading(false);
        console.log("loadItems try to retrive pending items.", res)
        if (res.values) {//有数值时才显示
            res.values.forEach(function(item){
                item.myScore = 0;//默认认为未打分
                if(items.find(entry => entry.id == item.id)){ //排重
                    //do nothing
                }else{
                    //如果已打分则添加到对应数值记录，用于初始化显示
                    if(res.scores){
                        var myScore = res.scores.find(entry => entry.dictValue.id == item.id);
                        if(myScore){ //找到对应值的打分
                            item.myScore = myScore.score;
                        }
                    }
                    items.push(item);
                    //显示到页面
                    insertItem();
                }
            });           
        }else{//如果没有则提示，
            shownomore();
            if(!items || items.length==0){
                $("#Center").append("<div style='font-size:12px;line-height:24px;width:100%;text-align:center;'>没有数据标注任务哦~~</div>");
            }            
        }
    }, 
    "GET",
    {
        dictId:dictId,
        openid:userInfo._key,//当前用户openid
    },
    {});
}

//将item显示到页面
var cardTpl = `
        <div style='border:1px solid silver; border-radius:5px;margin:5px 0;width:96%;margin-left:2%;display:flex;flex-direction:row;align-items: center; padding:5px;'>
            <div style="width:50%;">
                <div style="font-size:12px;font-weight:bold;margin:2px 0;">__categoryName __schemeName</div>
                <div style="font-size:12px;line-height:14px;overflow: hidden; text-overflow: ellipsis;display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3;">__orginalValue</div>
            </div>
            <div style="width:20%;">
                <div style="text-align:center;font-size:16px;font-weight:bold;">__score</div>
                <div style="text-align:center;font-size:10px;">__markers</div>
            </div>
            <div id="rank__itemType__itemId" data-id="__itemId" data-type="__itemType" data-categoryid="__categoryId" data-schemeid="__schemeId" data-ovalue="__orginalValue"  style="width:30%;margin-top:-5px;" ></div>
            <!--div id="go__itemType__itemId" data-id="__itemId" data-type="__itemType" data-categoryid="__categoryId" data-schemeid="__schemeId" style="font-size:12px;width:10%;text-align:center;font-size:14px;font-weight:bold;">&gt;</div-->
        </div>
    `;    
function insertItem(){
    // 加载内容
    var item = items[num-1];
    if(!item){
        shownomore(true);
        return;
    }

    var html = cardTpl;
    var type = "";
    html = html.replace(/__itemId/g,item.id);
    html = html.replace(/__orginalValue/g,item.originalValue);
    html = html.replace(/__score/g,item.markedValue);
    html = html.replace(/__markers/g,(item.markers+1)+"人标注");
    html = html.replace(/__categoryId/g,item.category&&item.category.id?item.category.id:"");
    html = html.replace(/__categoryName/g,item.category&&item.category.name?item.category.name:"");
    if(item.measure && item.measure.id && item.measure.name){ //如果是performance值
        type="humanMarkedValue";
        html = html.replace(/__schemeId/g,item.measure.id);
        html = html.replace(/__schemeName/g,item.measure.name);
    }else if(item.dictMeta && item.dictMeta.id && item.dictMeta.name){ //如果是dict值
        type="humanMarkedDict";
        html = html.replace(/__schemeId/g,item.dictMeta.id);
        html = html.replace(/__schemeName/g,item.dictMeta.name);
    }else{
        console.log("unknown data type.",item);
        html = "";//注意：数据错误时直接不予显示
    }
    html = html.replace(/__itemType/g,type);

    $("#waterfall").append("<li>"+html+"</li>");
    num++;

    //打分
    $("#rank"+type+item.id).starRating({//显示为starRating
        totalStars: 5,
        starSize:20,
        useFullStars:false,//能够显示半星
        initialRating: item.myScore/2,//注意：评分是0-1,直接转换。初始打分为当前用户的设置值，如果没有则置空，等待标注
        ratedColors:['#dc143c', '#ff4500', '#ff6347', '#9acd32','#32cd32'],
        callback: function(currentRating, el){
            //获取当前打分
            var type = $(el).data("type");
            var nScore={
                score: currentRating*2, //直接用打分值
                openid: userInfo._key,
                nickname: userInfo.nickname,
                originalValue: $(el).data("ovalue"),
                category:{
                    id:$(el).data("categoryid")
                }
            };
            if(type == "humanMarkedValue"){
                nScore.performance={
                    id: $(el).data("id") 
                }
                nScore.measure={
                    id: $(el).data("schemeid")
                }                
            }else if(type == "humanMarkedDict"){
                nScore.dictValue={
                    id: $(el).data("id")
                }
                nScore.dictMeta={
                    id: $(el).data("schemeid")
                }                
            }else{
                nScore.error = "unknow type:"+type;
            }
            console.log("dude, now try update rating.", nScore);

            //提交数据
            $.ajax({
                url:app.config.sx_api+"/ope/"+type+"/rest/score",
                type:"post",
                data:JSON.stringify(nScore),
                headers:{
                    "Content-Type":"application/json",
                    "Accept": "application/json"
                },         
                success:function(json){
                    console.log("score updated.",json);
                }
            });  
        }
    }); 
    /**
    //注册事件： 进入属性下所有数值列表
    $("#go"+type+item.id).click(function(){
        //根据类型区分  
        var type = $(this).data("type");
        if(type == "humanMarkedValue"){
            window.location.href = "data-by-measure.html?id="+$(this).data("schemeid");
        }else if(type == "humanMarkedDict"){
            window.location.href = "data-by-dict.html?id="+$(this).data("schemeid");
        }else{
            console.log("unknown type. ignore");
        }
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

    //跳转到相应页面
    window.location.href = currentActionType+".html";
}


