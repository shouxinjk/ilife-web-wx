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
    //显示加载状态
    showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    if(args["id"]){
        currentPerson = args["id"]; //如果传入参数则使用传入值
    }
    $('#waterfall').NewWaterfall({
        width: width-20,
        delay: 100,
    });
    $("body").css("background-color","#fff");//更改body背景为白色

    loadPerson(currentPerson);//加载用户
    //loadData();//加载数据：默认使用当前用户查询

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });

});

util.getUserInfo();//从本地加载cookie

var loading = false;
var dist = 50;
var num = 1;//需要加载的内容下标

var items = [];
var page = {//翻页控制
  size: 20,//每页条数
  total: 1,//总页数
  current: -1//当前翻页
};

var currentActionType = '';//当前操作类型
var tagging = '';//操作对应的action 如buy view like 等

var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:null;
var userInfo=app.globalData.userInfo;//默认为当前用户

setInterval(function ()
{
    //console.log("interval",$(window).scrollTop(),$(document).height(),$(window).height(),$(document).height() - $(window).height() - dist);
    if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
    {
        // 表示开始加载
        loading = true;

        // 加载内容
        if(items.length < num){//如果内容未获取到本地则继续获取
            //console.log("load from remote ");
            loadData();
        }else{//否则使用本地内容填充
            //console.log("load from locale ");
            insertItem();
        }
    }
}, 60);

//load feeds
function loadData() {
    console.log("User::loadData", currentPerson);
    //设置query
    var esQuery = {//搜索控制
      from: (page.current + 1) * page.size,
      size: page.size,
      query: {
        bool: {
          must: [
            {
              "match": {
                "userId": currentPerson
              }
            }
          ]
        }
      },
      collapse: {
        field: "itemId"//根据itemId 折叠，即：一个item仅显示一次
      },
      sort: [
        //{ "weight": { order: "desc" } },//权重高的优先显示
        { "@timestamp": { order: "desc" } },//最近操作的优先显示
        { "_score": { order: "desc" } }//匹配高的优先显示
      ]
    };

    if (tagging && tagging.length > 0) {//如果设置了操作类型，如like、favorite、buy等，则设置过滤条件
      esQuery.query.bool.must.push({
        "match": {
          "action": "view"//TODO 这里应该展示favorite内容
        }
      });
    }

    //设置请求头
    var esHeader = {
      "Content-Type": "application/json",
      "Authorization": "Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
    };

    console.log("search user action. [query]"+JSON.stringify(esQuery),esQuery);
    $.ajax({
        url:app.config.search_api+"/actions/_search",
        type:"post",
        data:JSON.stringify(esQuery),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:{
            "Content-Type":"application/json",
            "Authorization":"Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
        },
        //crossDomain: true,
        success:function(data){
            console.log("User::loadData success.",data);
            if(data.hits.hits.length==0){//如果没有内容，则显示提示文字
                shownomore(true);
                showloading(false);
            }else{
                //更新总页数
                var total = data.hits.total;
                page.total = (total + page.size - 1) / page.size;
                //更新当前翻页
                page.current = page.current + 1;
                //装载具体条目
                var hits = data.hits.hits;
                for(var i = 0 ; i < hits.length ; i++){
                    items.push(hits[i]._source.item);
                }
                insertItem();
                showloading(false);
            }
        }
    });
  }

//load related persons
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        userInfo = res;
        currentPerson = res._key;
        //insertPerson(userInfo);
        loadData();
        loadBrokerByOpenid(res._key);//根据openid加载broker信息
    });
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

//将item显示到页面
function insertItem(){
    // 加载内容
    var item = items[num-1];
    console.log("Favorite::insertItem add item to html.",num,item);
    var image = "<img src='"+item.images[0].replace(/\.avif/,'')+"' width='60px' height='60px'/>"
    var tagTmpl = "<a class='itemTagTiny' href='index.html?keyword=__TAGGING'>__TAG</a>";
    var tags = "<div class='itemTagging'>";
    tags += "<div class='itemTagging-summary'>";
    tags += "<a class='itemTagPrice' href='#'>"+(item.price.currency?item.price.currency:"¥")+item.price.sale+"</a>";
    var tagTmplBlank = "<a class='itemTagBlank' href='index.html?keyword=__TAGGING'>__TAG</a>";
    tags += tagTmplBlank.replace("__TAGGING",item.distributor.name).replace("__TAG",item.distributor.name);
    tags += "</div>";
    tags += "<div class='itemTagging-list'>";
    var taggingList = [];
    if(item.tagging && item.tagging.length>0){
        taggingList = item.tagging.split(" ");    
    }
    for(var t in taggingList){
        var txt = taggingList[t];
        if(txt.trim().length>1 && txt.trim().length<6){
            tags += tagTmpl.replace("__TAGGING",txt).replace("__TAG",txt);
        }
    }
    if(item.categoryId && item.categoryId.trim().length>1){
        tags += tagTmpl.replace("__TAGGING",item.category).replace("__TAG",item.category);
    }
    tags += "</div>";
    tags += "</div>";
    //var tags = "<span class='title'><a href='info.html?category="+category+"&id="+item._key+"'>"+item.title+"</a></span>"
    var title = "<div class='fav-item-title'>"+item.title+"</div>"
    $("#waterfall").append("<li><div class='feed-separator' style='border-radius:0'></div><div class='fav-item' data='"+item._key+"'><div class='fav-item-logo'>" + image +"</div><div class='fav-item-tags'>" +title + tags+ "</div></li>");
    num++;

    //注册事件
    $("div[data='"+item._key+"']").click(function(){
        //跳转到详情页面
        window.location.href = "info2.html?id="+item._key;
    });

    // 表示加载结束
    showloading(false);
    loading = false;    
    num++;  
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

