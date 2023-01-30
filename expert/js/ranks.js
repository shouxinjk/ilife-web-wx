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

    if(args["categoryId"]){
        categoryId = args["categoryId"]; //记录当前修改节点维度
    }    

    $("body").css("background-color","#fff");//更改body背景为白色

    //注册事件：新建排行榜
    $("#createRankBtn").click(function(e){
        if(!categoryId){
            siiimpleToast.message('请选择类目~~',{
              position: 'bottom|center'
            });             
        }else{
            window.location.href = "../measures.html?categoryId="+categoryId+"&categoryName="+categoryName;
        }
    }); 

    //注册事件：切换操作类型
    $(".order-cell").click(function(e){
        changeActionType(e);
    });      
    //loadPerson(currentPersonId);//加载需要修改的用户信息

    //加载所有类目列表：注意是加载全部类目
    loadCategories();//加载后将自动高亮，并加载排行榜数据

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

var currentPerson = {};//默认当前修改用户为空

var sxTimer = null;
var sxStartTimestamp=new Date().getTime();//定时器如果超过2分
var sxLoopCount = 1000;//定时器运行100次即停止，即30秒

//加载建立有排行榜的类目列表：一次加载全部，用于顶部滑动条
var categories = [];
function loadCategories() {
    util.AJAX(app.config.sx_api+"/mod/itemCategory/rest/rank-categories", function (res) {
        console.log("got categories.",res);
        categories = res;
        showSwiper();    
    });
}
//显示滑动条
function showSwiper(){
    //装载到页面
    categories.forEach(function(item){
        if(item.id != "1") //排除根节点
            insertCategoryItem(item);
    });
  
    //显示滑动条
    var mySwiper = new Swiper ('.swiper-container', {
        slidesPerView: 7,
    });  
    //调整swiper 风格，使之悬浮显示
    /**
    $(".swiper-container").css("position","fixed");
    $(".swiper-container").css("left","0");
    $(".swiper-container").css("top","0");
    $(".swiper-container").css("z-index","999");
    $(".swiper-container").css("background-color","#fff");
    //$(".swiper-container").css("margin-bottom","3px");
    //**/
  
    //将当前选中条目设为高亮  
    if(categoryId){//有指定Id则直接高亮
        var category = categories.find(item => item.id == categoryId);
        if(category){
            changeCategory(category);
        }else{
            console.log("cannot find category by id.",$(this).data("id"));
        }         
    }
  
}

//显示滑动条显示元素：category，包括LOGO及名称
function insertCategoryItem(category){
    //logo
    var logo = "http://www.shouxinjk.net/static/logo/distributor/ilife.png";
    if(category.logo && category.logo.indexOf("http")>-1){
        logo = category.logo;
    }else if(category.logo && category.logo.trim().length>0){
        logo = "http://www.shouxinjk.net/static/logo/category/"+category.logo;
    }
    // 显示HTML
    var html = '';
    html += '<div class="swiper-slide">';
    html += '<div class="person" id="'+category.id+'" data-id="'+category.id+'">';
    var style = category.id==categoryId?'-selected':'';
    html += '<div class="person-img-wrapper"><img class="person-img'+style+'" src="'+logo+'"/></div>';
    html += '<span class="person-name">'+category.name+'</span>';
    html += '</div>';
    html += '</div>';
    $("#categories").append(html);

    //注册事件:点击后切换
    $("#"+category.id).click(function(e){
      console.log("change category.",$(this).data("id"));
      var category = categories.find(item => item.id == $(this).data("id"));
      if(category){
        changeCategory(category);
      }else{
        console.log("cannot find category by id.",$(this).data("id"));
      }
      
    });
}
//切换Category
function changeCategory (category) {
    console.log("change category.",category);
    $("#"+categoryId+" img").removeClass("person-img-selected");
    $("#"+categoryId+" img").addClass("person-img");
    $("#"+category.id+" img").removeClass("person-img");
    $("#"+category.id+" img").addClass("person-img-selected");

    $("#"+categoryId+" span").removeClass("person-name-selected");
    $("#"+categoryId+" span").addClass("person-name");
    $("#"+category.id+" span").removeClass("person-name");
    $("#"+category.id+" span").addClass("person-name-selected");

    categoryId = category.id;
    categoryName = category.name;

    $("#waterfall").empty();//清空原有列表
    //$("#waterfall").css("height","20px");//调整瀑布流高度
    showloading(true);//显示加载状态

    page.current = -1;//从第一页开始查看
    items = [];//清空列表
    num = 1;//从第一条开始加载
    loadData();//重新加载数据

} 

//开始加载数据
//function loadItems(){
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
//}

function loadData(){
    util.AJAX(app.config.sx_api+"/mod/rank/rest/paged-ranks", function (res) {
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
                $("#Center").append("<div style='font-size:12px;line-height:24px;width:100%;text-align:center;'>没有排行榜~~</div>");
            }            
        }
    }, 
    "POST",
    {
        categoryId:categoryId?categoryId:"",
        from:(page.current+1)*page.size,
        to:(page.current+1)*page.size+page.size
    },
    {
        "Content-Type":"application/json",
        "Accept": "application/json"
    });
}


//排行榜设置模板
var rankTpl = `
    <div class='sx_seperator' style='margin:5px 0;width:90%;margin-left:5%;'></div>
    <div id="rank__id" data-id="__id" style="display:flex;flex-direction: row;flex-wrap: nowrap;width:100%;padding:5px;align-items: center;justify-content: center;">
        <div style="width:20%;text-align:center;">
            <img src="__logo" style="width:60px;height:60px;object-fit: cover;border-radius: 10px;"/>
        </div>
        <div style="width:76%">
            <div style="display:flex;flex-direction: row;flex-wrap: nowrap;width:100%;align-items: center;">
                <div id="rankCategoryName__id" style="font-size:12px;line-height:16px;font-weight:bold;text-overflow:ellipsis;overflow: hidden;white-space: nowrap;">__categoryName</div>
                <div id="rankKeyword__id" style="font-size:10px;display:flex;flex-direction: row;flex-wrap: nowrap;text-overflow:ellipsis;overflow: hidden;white-space: nowrap;"></div>
            </div>
            <div id="rankName__id" style="font-size:16px;line-height:20px;font-weight:bold;;">__name</div>
            <div id="rankDesc__id" style="font-size:12px;line-height:16px;;">__desc</div>
            <!--排序规则:显示为grid-->   
            <div id="rankItems__id">
                
            </div>                
        </div>
    </div> 
`;
//排行榜排序条目模板
var rankItemTpl = `
  <div class="element-item post-transition metal " id="rankItem__dimensionid" data-dimensionid="__dimensionid" data-priority="__priority" data-bgcolor="__bgcolor" style="background-color:__bgcolor">
    <h5 class="name" style="font-size:10px;">__name</h5>
    <p class="symbol" data-sort="__sort" id="sort__dimensionid">__sort</p>
    <p class="number">__weight</p>
  </div>
`;
var colors = ['#8b0000', '#dc143c', '#ff4500', '#ff6347', '#1e90ff','#40e0d0','#0dbf8c','#9acd32','#32cd32','#228b22','#067633'];
var weightSum=0;//由于参与排行的维度数量会变化，需要重新计算
//显示排行榜条目
function insertItem(){
    // 加载内容
    var rank = items[num-1];
    console.log("try insert rank item.",rank);
    if(!rank){
      shownomore(true);
      return;
    }

    //logo
    var logo = "http://www.shouxinjk.net/static/logo/distributor/ilife.png";
    if(rank.category.logo && rank.category.logo.indexOf("http")>-1){
        logo = rank.category.logo;
    }else if(rank.category.logo && rank.category.logo.trim().length>0){
        logo = "http://www.shouxinjk.net/static/logo/category/"+rank.category.logo;
    }
    //基本信息
    var rankHtml = rankTpl.replace(/__id/g,rank.id).replace(/__name/g,rank.name).replace(/__categoryName/g,rank.category.name)
                .replace(/__keyword/g,rank.keywords?rank.keywords:"").replace(/__desc/g,rank.description).replace(/__logo/g,logo);
    $("#waterfall").append(rankHtml);
    //添加关键字
    if(rank.keywords){
        rank.keywords.split(" ").forEach(function(keyword){
            if(keyword.trim().length>0){
                $("#rankKeyword"+rank.id).append("<div style='font-size:10px;border-radius:10px;padding:1px 5px;border:1px solid silver;margin-left:2px;'>"+keyword+"</div>");
            }
        });
    }

    //注册事件
    $("#rank"+rank.id).click(function(){
        //跳转到详情页
        window.location.href = "rank.html?id="+$(this).data("id");
    });

    //显示排行规则
    $("#rankItems"+rank.id).empty();//先清空
    if(rank.items){
      console.log("show rank items.",rank.items);
      var weightSum = 0;
      rank.items.forEach(function(rankItem){
        weightSum += rankItem.dimension.weight;
      });
      var i=0;
      rank.items.forEach(function(rankItem){
        var dimension = rankItem.dimension;
        var rankItemHtml = rankItemTpl;
        rankItemHtml = rankItemHtml.replace(/__dimensionid/g,dimension.id);
        rankItemHtml = rankItemHtml.replace(/__name/g,dimension.name);
        rankItemHtml = rankItemHtml.replace(/__priority/g,rankItem.priority);
        rankItemHtml = rankItemHtml.replace(/__sort/g,(i+1));
        rankItemHtml = rankItemHtml.replace(/__weight/g,Number((dimension.weight/weightSum*100).toFixed(0))+"%");
        rankItemHtml = rankItemHtml.replace(/__bgcolor/g,colors[i]);//使用缓存颜色
        $("#rankItems"+rank.id).append(rankItemHtml);
        i++;
      });
    }

    // 表示加载结束
    showloading(false);
    loading = false;    
    num++; 

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


