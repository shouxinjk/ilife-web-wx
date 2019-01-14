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
        { "weight": { order: "desc" } },//权重高的优先显示
        { "@timestamp": { order: "desc" } },//最近操作的优先显示
        { "_score": { order: "desc" } }//匹配高的优先显示
      ]
    };

    if (tagging && tagging.length > 0) {//如果设置了操作类型，如种草、拔草、养草，则设置过滤条件
      esQuery.query.bool.must.push({
        "match": {
          "action": tagging
        }
      });
    }

    //设置请求头
    var esHeader = {
      "Content-Type": "application/json",
      "Authorization": "Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
    };

    $.ajax({
        url:app.config.search_api+"/actions/_search",
        type:"post",
        data:JSON.stringify(esQuery),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:{
            "Content-Type":"application/json",
            "Authorization":"Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
        },
        crossDomain: true,
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
                //insertItem();
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
        insertPerson(userInfo);
        loadData();
    });
}

//将person显示到页面
/*
        <view class="info-general">
          <image class="general-icon" src="{{userInfo.avatarUrl}}" catchtap="navigateTo" data-url="{{userInfo._key}}"></image>
        </view>
        <view class="info-detail">
          <progress percent="80" stroke-width="12" active/>
          <view class="info-text info-blank">{{userInfo.nickName}}</view>
          <view class="info-text info-blank">{{userInfo.city?userInfo.city:""}}</view>
        </view>
*/
function insertPerson(person){
    // 显示HTML
    var html = '';
    html += '<div class="info-general">';
    html += '<img class="general-icon" src="'+person.avatarUrl+'" height="60px"/>';
    html += '</div>';
    html += '<div class="info-detail">';
    html += '<div class="info-text info-blank">'+person.nickName+'</div>';
    html += '<div class="info-text info-blank">'+(person.province?person.province:"")+(person.city?person.city:"")+'</div>';
    html += '</div>';
    $("#user").append(html);
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
    var item = items[num-1];//从本地取一条item
    console.log("User::insertItem add item to html.",num,item);
    var html = '';
    html += '<li><div class="WxMasonry">';
    html += '<div id="item'+item._key+'">';
    html += htmlItemImage(item);
    html += htmlItemSummary(item);
    html += htmlItemTags(item);
    html += '</div>';
    html += '</div></li>';
    $("#waterfall").append(html);

    //注册事件
    $("#item"+item._key).click(function(){
        //跳转到详情页
        window.location.href = "info2.html?id="+item._key;
    });
    // 表示加载结束
    showloading(false);
    loading = false;    
    num++;
}

function htmlItemImage(item){
    var html = '';
    html += '<div class="mainbody">';
    html += '<img class="WxMasonryImage" id="'+item._key+'" src="'+item.images[0]+'" width="100%" height="200px" />';
    html += '</div>';
    return html;
}

function htmlItemSummary(item){
    var html = '';
    html += '<div class="shopping">';
    html += '<div class="shopping-summary">';
    if(item.source.length>0){
        html += '<img class="shopping-icon" class="shopping-icon" src="http://www.shouxinjk.net/list/images/source/'+item.source+'.png"/>';
    }
    if(item.distributor.name.length>0){
        html += '<text class="box-title">'+item.distributor.name+'</text>';
    }
    html += '</div>';
    html += '<div class="likes">';
    if(item.price.currency){
        html += '<text class="currency">'+item.price.currency+'</text>';
    }else{
        html += '<text class="currency">¥</text>';
    }
    html += '<text class="price-sale">'+item.price.sale+'</text>';
    if(item.price.bid){
        html += '<text class="price-bid">/</text>';
        html += '<text class="price-bid">'+item.price.bid+'</text>';
    }
    html += '</div>';
    html += '</div> ';
    return html;
}

function htmlItemTags(item){
    var html = '';
    html += '<div class="list-box">';
    html += '<div class="main-item">';
    html += '<div class="list-box-title">'+item.title+'</div>';
    if(item.tags.length>0){
        html += '<div class="tags">';
        for(var i=0;i<item.tags.length;i++){
            if(item.tags[i].trim().length>0){
                html += '<div class="tag-text">#'+item.tags[i]+'</div>';
            }
        }
        html += '</div>';
    }
    html += '</div>';
    html += '</div>';
    return html;
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
    //更新内容列表
    $("#waterfall").empty();//清空原有列表
    $("#waterfall").css("height","20px");//调整瀑布流高度
    showloading(true);//显示加载状态

    page.current = -1;//从第一页开始查看
    items = [];//清空列表
    num=1;//从第一条开始显示
    loadData();//重新加载数据
  }

