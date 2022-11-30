// 文档加载完毕后执行
$(document).ready(function ()
{
        //根据屏幕大小计算字体大小
    const oHtml = document.getElementsByTagName('html')[0]
    width = oHtml.clientWidth;
    var rootFontSize = 12 * (width / 1440);// 在1440px的屏幕基准像素为12px
    rootFontSize = rootFontSize <8 ? 8:rootFontSize;//最小为8px
    rootFontSize = rootFontSize >16 ? 16:rootFontSize;//最大为18px
    oHtml.style.fontSize = rootFontSize+ "px";   
    //计算图片流宽度：根据屏幕宽度计算，最小显示2列
    /**
    if(width < 2*columnWidth){//如果屏幕不能并排2列，则调整图片宽度
        columnWidth = (width-columnMargin*4)/2;//由于每一个图片左右均留白，故2列有4个留白
    }    
    //**/
    //显示加载状态
    showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    //category = args["category"]?args["category"]:0; //如果是跳转，需要获取当前目录
    if(args["id"])inputPerson=args["id"];//从请求中获取需要展示的person或personaId
/**
    $('#waterfall').NewWaterfall({
        width: width-20,//1列
        //width: columnWidth,//动态列宽，当前为2列
        delay: 100,
    });
    //**/


    $("body").css("background-color","#fff");//更改body背景为白色

    util.getUserInfo();//从本地加载cookie
    loadBrokerInfo(); //从本地加载达人信息
    
    searchCategory();//默认发起类目检索
    loadFeeds();//默认查询所有方案

    //注册事件：点击搜索后重新查询meta category
    $("#findAll").click(function(){//注册搜索事件：点击搜索全部
        $("#categoryDiv").empty();
        searchCategory();  
        loadFeeds();//重新查询方案   
    });  

    //注册事件：点击后开始创建新的solution
    $("#btnPublish").click(function(){
      createSolution();
    }) 
    //取消充值
    $("#btnCancel").click(function(e){
        $.unblockUI(); 
    });      

    //注册事件：点击开始创建按钮
    $("#createProposalBtn").click(function(){
      if(categoryId == "board"){//如果是board则直接创建
          console.log("try create board");
          createBoard();       
      }else if(categoryId && categoryId.trim().length>0){//如果已经选中了主题则直接创建
        createSolution();
      }else{//否则需要选择主题
        //显示数据填报表单
        $.blockUI({ message: $('#chooseSchemeForm'),
            css:{ 
                padding:        10, 
                margin:         0, 
                width:          '80%', 
                top:            '30%', 
                left:           '10%', 
                textAlign:      'center', 
                color:          '#000', 
                border:         '1px solid silver', 
                backgroundColor:'#fff', 
                cursor:         'normal' 
            },
            overlayCSS:  { 
                backgroundColor: '#000', 
                opacity:         0.7, 
                cursor:          'normal' 
            }
        }); 
      }
    });  

});

var width = 600;
var clientWidth = 600;

var categoryId = null; //记录当前切换的metaCategory。由于启用定时器，切换时有延迟，导致加载的是上一个category商品的情况
var categoryName = ""; //作为推荐搜索关键字，切换类目后用类目名称填写

var columnWidth = 300;//默认宽度300px
var columnMargin = 5;//默认留白5px

var loading = false;
var dist = 500;
var num = 1;//需要加载的内容下标

var items = [];
var page = {//翻页控制
  size: 20,//每页条数
  total: 1,//总页数
  current: -1//当前翻页
};

var persons = [];
var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:JSON.parse($.cookie('sxUserInfo'))._key;//本地加载当前用户
var currentPersonTagging = "";//记录当前用户的标签清单，用于根据标签显示内容
var currentPersonType = "person";//当前选中的是用户还是画像，默认进入时显示当前用户
var personKeys = [];//标记已经加载的用户key，用于排重

var inputPerson = null;//接收指定的personId或personaId

//根据当前选中schemeId创建一个空白solution并且跳转到编辑界面，等待完善
function createSolution(){
    $.ajax({
        url:app.config.sx_api+"/diy/solution/rest/blank/"+categoryId,
        type:"post",
        data:JSON.stringify({
          forOpenid:app.globalData.userInfo._key,
          byOpenid:app.globalData.userInfo._key,
          byNickname:app.globalData.userInfo.nickname,
          forNickname:app.globalData.userInfo.nickname 
        }),
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },
        timeout:3000,//设置超时
        success:function(ret){
            console.log("create blank solution success.",ret);
            if(!ret.success ){//创建失败
              siiimpleToast.message('糟糕，出错了~~',{
                position: 'bottom|center'
              }); 
            }else{
                //直接跳转到编辑页面等待完善
                window.location.href="solution-modify.html?id="+ret.solution.id;
            }
        },
        error: function () {//调用出错执行的函数
            //请求出错处理：超时则直接显示搜索更多按钮
              siiimpleToast.message('糟糕，出错了~~',{
                position: 'bottom|center'
              }); 
          }
    });  
}

//创建一个空白board并等待添加内容
function createBoard(){
    var header={
        "Content-Type":"application/json"
    };     
    var boardkeywords = "";
    var data = {
        broker:{
            id:broker&&broker.id?broker.id:"system"
        },
        logo:"",
        title:app.globalData.userInfo && app.globalData.userInfo.nickName ?app.globalData.userInfo.nickName+" 的推荐清单":"新的推荐清单",
        //title:broker&&broker.name?broker.name+" 的推荐清单":"新的推荐清单",
        description:"商品组合，能够按主题把商品聚集在一起",
        tags:boardkeywords,
        poster:JSON.stringify({}),
        article:JSON.stringify({}),
        keywords:boardkeywords,
        byNickname: app.globalData.userInfo.nickname,
        byOpenid: app.globalData.userInfo.openid
    };
    util.AJAX(app.config.sx_api+"/mod/board/rest/board", function (res) {
        console.log("Broker::Board::AddBoard create board successfully.", res)
        if(res.status){
            console.log("Broker::Board::AddBoard now jump to home page for item adding.", res)
            var expDate = new Date();
            expDate.setTime(expDate.getTime() + (15 * 60 * 1000)); // 15分钟后自动失效：避免用户不主动修改
            $.cookie('board', JSON.stringify(res.data), { expires: expDate, path: '/' });  //把编辑中的board写入cookie便于添加item
            //显示提示浮框
            siiimpleToast.message('清单已创建，请添加明细条目~~',{
                  position: 'bottom|center'
                });    
            //前往首页
            setTimeout(function(){
              window.location.href = "index.html?boardId="+res.id;
            },1000);                  
        }
    }, "POST",data,header);
}

//优先从cookie加载达人信息
var broker = {
  id:"77276df7ae5c4058b3dfee29f43a3d3b",//默认设为Judy达人
  nickname:"小确幸大生活"
}
function loadBrokerInfo(){
  broker = util.getBrokerInfo();//先设置为本地信息
  loadBrokerByOpenid(app.globalData.userInfo._key);//重新加载
}
//load person
function loadPerson(personId) {
    console.log("try to load person info.",personId);
    util.AJAX(app.config.data_api+"/user/users/"+personId, function (res) {
        console.log("load person info.",personId,res);
        syncPerson(res);//提交用户昵称到后端
        //loadBrokerByOpenid(res._key);//根据openid加载broker信息
    });
}
//同步用户信息：将用户昵称及头像同步到后台
function syncPerson(person){
    //同时更新broker的nickname及avatarUrl：由于微信不能静默获取，导致broker内缺乏nickname及avatarUrl
    console.log("try to sync broker info.",person);
    $.ajax({
        url:app.config.sx_api+"/mod/broker/rest/sync/"+person._key,
        type:"post",
        data:JSON.stringify({
            nickname: person.nickName,
            avatarUrl:person.avatarUrl
        }),//注意：不能使用JSON对象
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },
        success:function(res){
            console.log("sync success.",res);
        },
        error:function(){
            console.log("sync failed.",person);
        }
    });     
}

//根据openid查询加载broker
function loadBrokerByOpenid(openid) {
    util.AJAX(app.config.sx_api+"/mod/broker/rest/brokerByOpenid/"+openid, function (res) {
        if (res.status) {//将佣金信息显示到页面
            broker = res.data;          
        }
    });
}

var sxInterval = null;
function loadFeeds(){
    //先清空原来的
    resetItemsInterval();
    sxInterval = setInterval(function ()
    {
        //console.log("interval",$(window).scrollTop(),$(document).height(),$(window).height(),$(document).height() - $(window).height() - dist);
        if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
        {
            // 表示开始加载
            loading = true;

            // 加载内容
            if(items.length < num){//如果内容未获取到本地则继续获取
                console.log("try load data.");
                loadData();
            }else{//否则使用本地内容填充
                //console.log("load from locale ");
                insertItem();
            }
        }
    }, 60);
}


//搜索得到metaCategory
var keyword = "*";
function searchCategory() {
    console.log("Measures::searchCategory",$("#searchTxt").val());
    if($("#searchTxt").val() && $("#searchTxt").val().trim().length>0)
      keyword = $("#searchTxt").val().trim();
    //直接查询
    $.ajax({
        url:app.config.sx_api+"/diy/proposalScheme/rest/byName/"+keyword,
        type:"get",
        data:{name:keyword},
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },
        timeout:3000,//设置超时
        success:function(data){
            console.log("Feed::loadData success.",data);
            if(data.length == 0){//如果没有内容，则显示提示文字
                //$("#categoryDiv").append("<div style='font-size:12px;'>没有匹配的定制方案，请重新尝试</div>");
                shownomore(true);
                showloading(false);
            }else{//显示到界面
                //先显示board
                insertCategoryItem({
                  id:"board",
                  name:"主题组合清单"
                });  
                //然后逐个显示
                data.forEach(function(item){
                    console.log("got item. ",item);
                    insertCategoryItem(item);                  
                });
                showloading(false);
            }
        },
        complete: function (XMLHttpRequest, textStatus) {//调用执行后调用的函数
            if(textStatus == 'timeout'){//如果是超时，则显示更多按钮
              console.log("ajax超时",textStatus);
              shownomore(true);
            }
        },
        error: function () {//调用出错执行的函数
            //请求出错处理：超时则直接显示搜索更多按钮
            shownomore(true);
          }
    });
  }

//清空缓存的商品列表、定时器及DOM元素，在切换目录时均需要调用
function resetItemsInterval(){
    //清空商品及定时器
    if(!sxInterval){
      clearInterval(sxInterval);
      sxInterval = null;
    }        
    //恢复当前分页并清空列表
    num = 1;
    page.current = -1;
    items = [];
    dist = 500;
    loading = false;
    $("#Center").empty();
    $("#Center").append('<ul id="waterfall"></ul>');
    $('#waterfall').NewWaterfall({
        width: width-20,//1列
        //width: columnWidth,//动态列宽，当前为2列
        delay: 100,
    });  
}


//根据选定的定制主题查询所有方案
var complexQueryTpl = JSON.stringify({//搜索控制
  from: (page.current + 1) * page.size,
  size: page.size,
  query: {
    bool: {
      must: [],
      should: []
    }
  },    
  sort: [
    { "timestamp": { order: "desc" } },//最近操作的优先显示
    { "_score": { order: "desc" } }//匹配高的优先显示
  ]
});

//设置query
function loadData() {
    console.log("Feed::loadData",categoryId);
    //默认查询：查询所有
    var esQuery={
        from:(page.current + 1) * page.size,
        size:page.size,
        query: {
            match_all: {}
        },
        sort: [
            { "timestamp": { order: "desc" }},
            { "_score":   { order: "desc" }}
        ]
    };

    //复杂查询：根据类型及scheme查询
    var complexQuery = {//搜索控制
                          from: (page.current + 1) * page.size,
                          size: page.size,
                          query: {
                            bool: {
                              must: [],
                              should: []
                            }
                          },    
                          sort: [
                            { "timestamp": { order: "desc" } },//最近操作的优先显示
                            { "_score": { order: "desc" } }//匹配高的优先显示
                          ]
                        };
    //如果有关键词则根据关键词过滤，否则匹配全部
    if(keyword && keyword.trim().length>1 && keyword!="*"){
      complexQuery.query.bool.should.push({
          match:{
            full_text:keyword
          }
        });        
    }

    //如果选定了类目则过滤
    if(categoryId && categoryId.trim().length>0){
      if(categoryId=="board"){
        complexQuery.query.bool.must.push({ //查询所有清单
            match:{
              type:"board"
            }
          }); 
      }else{
        complexQuery.query.bool.must.push({ //类型指定为solution
            match:{
              type:"solution"
            }
          }); 
        complexQuery.query.bool.must.push({ //且根据scheme过滤
            match:{
              scheme:categoryId
            }
          });         
      } 
    }

    //设置请求头
    var esHeader = {
      "Content-Type": "application/json",
      "Authorization": "Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
    };
    var q = JSON.stringify(categoryId||(keyword&&keyword.trim().length>1)?complexQuery:esQuery);
    console.log("try search.",q);
    $.ajax({
        url:"https://data.pcitech.cn/proposal/_search",
        type:"post",
        data:q,//根据是否有输入选择查询
        headers:esHeader,
        crossDomain: true,
        timeout:3000,//设置超时
        success:function(data){
            console.log("Feed::loadData success.",data);
            if(data.hits.total == 0 || data.hits.hits.length==0){//如果没有内容，则显示提示文字
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
                    items.push(hits[i]._source);
                }
                insertItem();
                showloading(false);
            }
        },
        complete: function (XMLHttpRequest, textStatus) {//调用执行后调用的函数
            if(textStatus == 'timeout'){//如果是超时，则显示更多按钮
              console.log("ajax超时",textStatus);
              shownomore(true);
            }
        },
        error: function () {//调用出错执行的函数
            //请求出错处理：超时则直接显示搜索更多按钮
            shownomore(true);
          }
    });
  }


//将item显示到页面
//所属类型、名称、创建时间
function insertItem(){
    // 加载内容
    var item = items[num-1];
    console.log("try insert item.",num,item,items);
    if(!item){
      shownomore(true);
      return;
    }
    //排重
    if($("#"+item.itemkey).length>0)
      return;

    var imgWidth = 60;//固定为100
    var imgHeight = 60;//随机指定初始值
    //计算图片高度
    var imgSrc = item.logo.replace(/\.avif/g,"");
    var img = new Image();
    img.src = imgSrc;
    var orgWidth = img.width;
    var orgHeight = img.height;
    imgHeight = orgHeight/orgWidth*imgWidth;
    //计算文字高度：按照1倍行距计算

    var image = "<img src='"+imgSrc+"' width='"+imgWidth+"' height='"+imgHeight+"'/>"

    var title = "<div class='fav-item-title'>"+item.name+"</div>";
    var author = "<div  class='author' style='font-size:12px;font-weight:bold;color:darkorange;margin:2px 0;'>"+item.author+"</div>";
    var tags = "<div style='display:flex;'>";
    //如果是board，默认第一个添加 主题组合清单标签
    if(item.type=="board"){
        tags += "<span style='border-radius:10px;background-color:#514c49;color:#fff;padding:2px 5px;margin-right:2px;font-size:10px;line-height:12px;'>主题组合清单</span>";      
    }
    if(item.tags && item.tags.length>0){//装载标签
        item.tags.forEach(function(tag){
            if(tag&&tag.trim().length>0)
                tags += "<span style='border-radius:10px;background-color:#514c49;color:#fff;padding:2px 5px;margin-right:2px;font-size:10px;line-height:12px;'>"+tag+"</span>";
        });
    }
    tags += "</div>";    
    var description = "<div class='fav-item-title' style='width:92%;margin-top:2px;font-weight:normal;font-size:12px;line-height: 14px;overflow: hidden; text-overflow: ellipsis;display: -webkit-box;-webkit-line-clamp: 4;-webkit-box-orient: vertical;'>"+item.description+"</div>";
    $("#waterfall").append("<li><div class='feed-separator' style='border-radius:0'></div><div class='fav-item' id='"+item.itemkey+"' data-type='"+item.type+"' style='margin:5px 0;'><div class='fav-item-logo'>" + image +"</div><div class='fav-item-tags' style='vertical-align:middle;'>" +title + author +tags+ description+ "</div></li>");

    num++;

    //注册事件：跳转到方案查看界面
    $("#"+item.itemkey).click(function(){
        var type = $(this).data("type");
        if(type=="solution"){
          window.location.href = "solution.html?id="+item.itemkey;
        }else if(type=="board"){
          window.location.href = "board2-waterfall.html?id="+item.itemkey;
        }else{
          console.log("unknown type.",type);
        }
        
    });

    // 表示加载结束
    loading = false;
}

/**
//已废弃：直接从数据库加载定制方案。已调整为从索引获取
//根据选定的定制主题查询所有方案
function loadData() {
    console.log("Feed::loadData",categoryId);
    var query = { //默认查询所有
          page:{
            pageNo: page.current,
            pageSize: page.size
          }
        };
    if(categoryId && categoryId.trim().length>0){
        query = {
          scheme:{id: categoryId},
          page:{
            pageNo: page.current,
            pageSize: page.size
          }
        };    
    }
    $.ajax({
        url:app.config.sx_api+"/diy/solution/rest/search",
        type:"post",
        data:JSON.stringify(query),
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },
        timeout:3000,//设置超时
        success:function(ret){
            console.log("Feed::loadData success.",ret);
            if(!ret.success || !ret.data || ret.data.length==0){//如果没有内容，则显示提示文字
                shownomore(true);
                showloading(false);
            }else{
                //更新当前翻页
                page.current = page.current + 1;
                //装载具体条目
                for(var i = 0 ; i < ret.data.length ; i++){
                    items.push(ret.data[i]);
                }
                insertItem();
                showloading(false);
            }
        },
        complete: function (XMLHttpRequest, textStatus) {//调用执行后调用的函数
            if(textStatus == 'timeout'){//如果是超时，则显示更多按钮
              console.log("ajax超时",textStatus);
              shownomore(true);
            }
        },
        error: function () {//调用出错执行的函数
            //请求出错处理：超时则直接显示搜索更多按钮
            shownomore(true);
          }
    });
  }


//将item显示到页面
//所属类型、名称、创建时间
function insertItem(){
    // 加载内容
    var item = items[num-1];
    console.log("try insert item.",num,item,items);
    if(!item){
      shownomore(true);
      return;
    }
    //排重
    if($("#"+item.id).length>0)
      return;

    var imgWidth = 60;//固定为100
    var imgHeight = 60;//随机指定初始值
    //计算图片高度
    var imgSrc = "https://www.biglistoflittlethings.com/static/logo/distributor/ilife.png";
    if(item.scheme && item.scheme.logo && item.scheme.logo.trim().length>0)
      imgSrc = item.scheme.logo;
    var img = new Image();
    img.src = imgSrc;
    var orgWidth = img.width;
    var orgHeight = img.height;
    imgHeight = orgHeight/orgWidth*imgWidth;
    //计算文字高度：按照1倍行距计算

    var image = "<img src='"+imgSrc+"' width='"+imgWidth+"' height='"+imgHeight+"'/>"

    var title = "<div class='fav-item-title'>"+item.name+"</div>";
    var author = "";
    if(item.byNickname){
      author = "<div  class='author' style='font-size:12px;font-weight:bold;color:darkorange;margin:2px 0;'>"+item.byNickname+"</div>";
    }
    var description = "<div class='fav-item-title' style='width:92%;font-weight:normal;font-size:12px;line-height: 14px;overflow: hidden; text-overflow: ellipsis;display: -webkit-box;-webkit-line-clamp: 4;-webkit-box-orient: vertical;'>"+item.description+"</div>";
    $("#waterfall").append("<li><div class='feed-separator' style='border-radius:0'></div><div class='fav-item' id='"+item.id+"'  style='margin:5px 0;'><div class='fav-item-logo'>" + image +"</div><div class='fav-item-tags' style='vertical-align:middle;'>" +title + author + description+ "</div></li>");
 


    num++;

    //注册事件：跳转到方案查看界面
    $("#"+item.id).click(function(){
        window.location.href = "solution.html?id="+item.id;
    });

    // 表示加载结束
    loading = false;
}
//**/

//load predefined personas
function loadPersonas() {
    util.AJAX(app.config.data_api+"/persona/personas/broker/"+app.globalData.userInfo._key, function (res) {
      var arr = res;
      //将persona作为特殊的person显示到顶部
      for (var i = 0; i < arr.length; i++) {
        var u = arr[i];
        if(personKeys.indexOf(u._key) < 0){
          u.nickName = u.name;//将persona转换为person
          u.avatarUrl = u.image;//将persona转换为person
          u.personOrPersona = "persona";//设置标记，用于区分persona及person
          persons.push(u);
          personKeys.push(u._key);
        }
      }

      //新增客群按钮
      var addPersonaKey = "btn-add-persona";
      personKeys.push(addPersonaKey);
      persons.push({
        nickName:"添加客群",
        avatarUrl:"images/add-persona.png",
        _key:addPersonaKey
      });       

      //显示滑动条
      showSwiper(); 
    });
}

//load related persons
function loadPersons() {
    util.AJAX(app.config.data_api+"/user/users/connections/"+app.globalData.userInfo._key, function (res) {
      var arr = res;
      //从列表内过滤掉当前用户：当前用户永远排在第一个
      //*
      if (app.globalData.userInfo != null && personKeys.indexOf(app.globalData.userInfo._key) < 0){
          persons.push(app.globalData.userInfo);
          personKeys.push(app.globalData.userInfo._key);
        }
      //**/
      for (var i = 0; i < arr.length; i++) {
        var u = arr[i];
        if(personKeys.indexOf(u._key) < 0/* && u.openId*/){//对于未注册用户不显示
          //如果是非注册用户则显示为客群
          if(!u.openId){
            u.personOrPersona = "persona";//设置标记，用于区分persona及person
          }
          persons.push(u);
          personKeys.push(u._key);
        }
      } 

      //新增关心的人按钮
      var addPersonKey = "btn-add-related-person";
      personKeys.push(addPersonKey);
      persons.push({
        nickName:"添加关心的人",
        avatarUrl:"images/add-person.png",
        _key:addPersonKey
      });      

      //显示顶部滑动条
      if(util.hasBrokerInfo()){//如果是达人，则继续装载画像
          loadPersonas();
      }else{//否则直接显示顶部滑动条
          showSwiper();
      } 
    });
}

function showSwiper(){
    //将用户装载到页面
    for (var i = 0; i < persons.length; i++) {
      insertPerson(persons[i]);
    }    
    //显示滑动条
    var mySwiper = new Swiper ('.swiper-container', {
        slidesPerView: 7,
    });  
    //调整swiper 风格，使之悬浮显示
    $(".swiper-container").css("position","fixed");
    $(".swiper-container").css("left","0");
    $(".swiper-container").css("top","0");
    $(".swiper-container").css("z-index","999");
    $(".swiper-container").css("background-color","#fff");
    //$(".swiper-container").css("margin-bottom","3px");
  
    //将当前用户设为高亮  
    if(inputPerson && personKeys.indexOf(inputPerson)>-1 && persons[personKeys.indexOf(inputPerson)]){//有输入用户信息则优先使用
      currentPerson = inputPerson;
      currentPersonType = persons[personKeys.indexOf(inputPerson)].personOrPersona?"persona":"person";
      currentPersonTagging = persons[personKeys.indexOf(inputPerson)].tags?persons[personKeys.indexOf(inputPerson)].tags.join(" "):"";
    }else{//根据当前用户加载数据：默认使用第一个
      currentPerson = persons[0]._key;
      currentPersonTagging = persons[0].tags?persons[0].tags.join(" "):"";   
    }   
    changePerson(currentPersonType,currentPerson,currentPersonTagging);    
}

//将person显示到页面
/*
<view class="person">
      <image class="person-img{{person._key==currentPerson?'-selected':''}}" src="{{person.avatarUrl}}" bindtap="changePerson" data-id="{{person._key}}"/>
      <view class="person-name">{{person.nickName}}</view>
</view>
*/

function insertPerson(person){
    // 显示HTML
    var html = '';
    html += '<div class="swiper-slide">';
    html += '<div class="person" id="'+person._key+'"data-type="'+(person.personOrPersona?"persona":"person")+'" data-tagging="'+(person.tags?person.tags.join(" "):"*")+'">';
    var style= person._key==currentPerson?'-selected':'';
    html += '<div class="person-img-wrapper"><img class="person-img'+style+'" src="'+person.avatarUrl+'"/></div>';
    html += '<span class="person-name">'+(person.personOrPersona=="persona"?"☆":"")+person.nickName+'</span>';
    html += '</div>';
    html += '</div>';
    $("#persons").append(html);

    //注册事件:点击后切换用户
    //通过jquery事件注入
    if(person._key=="btn-add-related-person"){//新增关心的人，直接跳转
      $("#"+person._key).click(function(e){
          window.location.href="user-choosepersona.html?from=feeds";
      });
    }else if(person._key=="btn-add-persona"){//新增客群，直接跳转
      $("#"+person._key).click(function(e){
          window.location.href="broker/my-addpersona.html?from=feeds";
      });
    }else{//切换数据列表
      $("#"+person._key).click(function(e){
          console.log("try to change person by jQuery click event.",person._key,e.currentTarget.type,e.currentTarget.id,e);
          changePerson(e.currentTarget.dataset.type,e.currentTarget.id,e.currentTarget.dataset.tagging);
      });
    }
}

//显示没有更多内容
function shownomore(flag){
  //检查是否是一条数据都没加载
  if(items.length==0){//需要特别处理：如果没有任何数据，则需要默认设置，否则导致无法显示show more btn
    $("#waterfall").height(10);
    $("#no-results-tip").toggleClass("no-result-tip-hide",false);
    $("#no-results-tip").toggleClass("no-result-tip-show",true);
  }    
  if(flag){
    $("#findMoreBtn").toggleClass("findMoreBtn-hide",false);
    $("#findMoreBtn").toggleClass("findMoreBtn-show",true);
    //注册跳转事件：跳转到推荐页，需要带有当前用户ID
    $("#findMoreBtn").click(function(){
      window.location.href = "index.html?keyword="+categoryName;
    });    
  }else{
    $("#findMoreBtn").toggleClass("findMoreBtn-hide",true);
    $("#findMoreBtn").toggleClass("findMoreBtn-show",false);
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
function insertCategoryItem(proposalScheme){
    if(!proposalScheme){
      shownomore(true);
      return;
    }
    //隐藏no-more-tips
    $("#no-results-tip").toggleClass("no-result-tip-hide",true);
    $("#no-results-tip").toggleClass("no-result-tip-show",false); 
    
    var measureTag = "<div id='metacat"+proposalScheme.id+"' data-id='"+proposalScheme.id+"' data-name='"+proposalScheme.name+"' style='line-height:16px;font-size:12px;min-width:60px;font-weight:bold;padding:2px;border:1px solid silver;border-radius:10px;margin:2px;'>"+proposalScheme.name+"</div>"
    $("#categoryDiv").append( measureTag );

    //注册事件
    $("#metacat"+proposalScheme.id).click(function(){
        console.log("meta category changed. ",  $(this).data("id") );

        categoryId = $(this).data("id"); //设置全局变量，避免interval延迟调用问题
        categoryName = $(this).data("name"); //设置全局变量，避免interval延迟调用问题

        //修改新建标题
        $("#createProposalTip").html("定制我的 "+categoryName);

        loadFeeds();//加载该主题下的具体方案列表

        //高亮
        $("div[id^=metacat]").css("background-color","#fff");
        $("div[id^=metacat]").css("color","#000");          
        $("#metacat"+categoryId).css("background-color","#2a61f1");
        $("#metacat"+categoryId).css("color","#fff");        
    });


    //同步写入主题选择Div
    var proposalTag = "<div id='proposal"+proposalScheme.id+"' data-id='"+proposalScheme.id+"' data-name='"+proposalScheme.name+"' style='line-height:20px;font-size:12px;min-width:60px;font-weight:bold;padding:2px 10px;border:1px solid silver;border-radius:20px;margin:2px;'>"+proposalScheme.name+"</div>"
    $("#proposalSchemesDiv").append( proposalTag );//同步写入候选表单
    //注册事件
    $("#proposal"+proposalScheme.id).click(function(){
        console.log("meta category changed. ",  $(this).data("id") );

        categoryId = $(this).data("id"); //设置全局变量，避免interval延迟调用问题
        categoryName = $(this).data("name"); //设置全局变量，避免interval延迟调用问题

        //高亮
        $("div[id^=proposal]").css("background-color","#fff");
        $("div[id^=proposal]").css("color","#000");          
        $("#proposal"+categoryId).css("background-color","#2a61f1");
        $("#proposal"+categoryId).css("color","#fff");        
    });

    // 表示加载结束
    showloading(false);
    loading = false;    
}

//更新item信息。只用于更新profit
function updateItem(item) {
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };  
    var url = app.config.data_api +"/_api/document/my_stuff/"+item._key;
    if (app.globalData.isDebug) console.log("Feeds::updateItem update item.",item);
    util.AJAX(url, function (res) {
      if (app.globalData.isDebug) console.log("Feeds::updateItem update item finished.", res);
      //do nothing
    }, "PATCH", item, header);
}

function changePerson (type,personId,personTagging) {
    var ids = personId;
    if (app.globalData.isDebug) console.log("Feed::ChangePerson change person.",currentPerson,personId);
    $("#"+currentPerson+" img").removeClass("person-img-selected");
    $("#"+currentPerson+" img").addClass("person-img");
    $("#"+ids+" img").removeClass("person-img");
    $("#"+ids+" img").addClass("person-img-selected");

    $("#"+currentPerson+" span").removeClass("person-name-selected");
    $("#"+currentPerson+" span").addClass("person-name");
    $("#"+ids+" span").removeClass("person-name");
    $("#"+ids+" span").addClass("person-name-selected");

    $("#waterfall").empty();//清空原有列表
    $("#waterfall").css("height","20px");//调整瀑布流高度
    showloading(true);//显示加载状态

    page.current = -1;//从第一页开始查看
    currentPerson = ids;//修改当前用户
    currentPersonTagging = personTagging;//修改当前用户推荐Tagging
    currentPersonType = type;//更改当前用户类型
    items = [];//清空列表
    num = 1;//从第一条开始加载
    //loadData();//重新加载数据
  } 

// 自动加载更多：此处用于测试，动态调整图片高度
function random(min, max)
{
    return min + Math.floor(Math.random() * (max - min + 1))
}

// 时间戳转多少分钟之前
function getDateDiff(dateTimeStamp) {
    // 时间字符串转时间戳
    var timestamp = new Date(dateTimeStamp).getTime();
    var minute = 1000 * 60;
    var hour = minute * 60;
    var day = hour * 24;
    var halfamonth = day * 15;
    var month = day * 30;
    var year = day * 365;
    var now = new Date().getTime();
    var diffValue = now - timestamp;
    var result;
    if (diffValue < 0) {
        return;
    }
    var yearC = diffValue / year;
    var monthC = diffValue / month;
    var weekC = diffValue / (7 * day);
    var dayC = diffValue / day;
    var hourC = diffValue / hour;
    var minC = diffValue / minute;
    if (yearC >= 1) {
        result = "" + parseInt(yearC) + "年前";
    } else if (monthC >= 1) {
        result = "" + parseInt(monthC) + "月前";
    } else if (weekC >= 1) {
        result = "" + parseInt(weekC) + "周前";
    } else if (dayC >= 1) {
        result = "" + parseInt(dayC) + "天前";
    } else if (hourC >= 1) {
        result = "" + parseInt(hourC) + "小时前";
    } else if (minC >= 1) {
        result = "" + parseInt(minC) + "分钟前";
    } else
        result = "刚刚";
    return result;
}

