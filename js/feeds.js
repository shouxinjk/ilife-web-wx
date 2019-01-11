// 文档加载完毕后执行
$(document).ready(function ()
{
    //显示加载状态
    showloading(true);
    //处理参数
    var args = getQuery();//获取参数
    //category = args["category"]?args["category"]:0; //如果是跳转，需要获取当前目录

    loadPersons();//加载用户
    loadData();//加载数据：默认使用当前用户查询

    var mySwiper = new Swiper ('.swiper-container', {
      direction: 'horizental',
      loop: false
    })

});

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
var currentPerson = app.globalData.userInfo?app.globalData.userInfo._key:null;//默认选中当前用户

setInterval(function ()
{
    if ($(window).scrollTop() >= $(document).height() - $(window).height() - dist && !loading)
    {
        // 表示开始加载
        loading = true;

        // 加载内容
        if(items.length < num){//如果内容未获取到本地则继续获取
            loadData();
        }else{//否则使用本地内容填充
            insertItem();
        }
    }
}, 60);

//load feeds
function loadData() {
    console.log("Feed::loadData", currentPerson);
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
    //设置请求头
    var esHeader = {
      "Content-Type": "application/json",
      "Authorization": "Basic ZWxhc3RpYzpjaGFuZ2VtZQ=="
    };
    util.AJAX("https://data.pcitech.cn/actions/_search", function (res) {
      console.log("Feed::loadData now parsing search result.", res);
      if (res.data.hits.hits.length == 0) {//如果没有更多，则显示提示文字
          shownomore(true);
          showloading(false);
      } else {
        var arr = res.data.hits.hits;// 获取结果
        for (var i = 0; i < arr.length; i++) {//将搜索结果放入列表
          var record = arr[i]._source;
          items.push(record.item);
        }
        insertItem();//显示到页面

        //更新翻页信息
        var total = res.data.hits.total;//获取匹配总数
        page.total = (total + page.size - 1) / page.size;
        page.current = page.current + 1;

        // 更新状态
        shownomore(false);
        showloading(false);
      }
    }, "post", JSON.stringify(esQuery), esHeader);
  },

//load related persons
function loadPersons() {
    util.AJAX(app.config.data_api+"user/users", function (res) {
      var arr = res.data;
      //把当前用户作为第一个
      if(app.globalData.userInfo){
        persons.push(app.globalData.userInfo);
      }
      //从列表内过滤掉当前用户：当前用户永远排在第一个
      for (var i = 0; i < arr.length; i++) {
        var u = arr[i];
        if (u._key != app.globalData.userInfo._key){
          persons.push(u);
        }
      }
      //将用户显示到页面
       for (var i = 0; i < persons.length; i++) {
        insertPerson(persons[i]);
      }           
    });
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
    var style= person._key==currentPerson?'-selected':'';
    var image = '<img class="person-img'+style+'" src="'+person.avatarUrl+'"/>';
    var title = '<div class="person-name">'+person.nickName+'</div>';
    $("#persons").append("<div class="swiper-slide person" id='person"+person._key+"'>" + image +title+ "</div>");

    //注册事件:点击后切换用户
    $("person"+person._key+"']").click(function(){
        changePerson(person._key);
    });
}

//显示没有更多内容
function shownomore(flag){
    var html = '';
    if(flag){
        html += '<text> 没有更多了 </text>';
    }
    $("#nomore").append(html);
}

//显示正在加载提示
function showloading(flag){
    var html = '';
    if(flag){
        html += '<image src="http://www.uusucai.com/d/file/web/tubiao/2015/06/19/5fc1dd5e77261ac65f5412ba66b466e4.gif" mode="widthFix"/>';
    }
    $("#loading").append(html);
}

/*
<view class="WxMasonry">
    <div  id="{{item._key}}" url="../detail/detail?id={{item._key}}">
        <view class="mainbody">
          <!--image-->
          <image class="WxMasonryImage" id="{{item.id}}" mode="aspectFill" src="{{item.images[0]}}" />
          <!--author-->
          <!--view class="host">
            <view class="host-avatar">
              <image class="host-avatar-img" mode="aspectFill" bindload="WxMasonryImageLoad" src="{{item.images[0]}}"/>
            </view>
            <text class="host-name">{{item.title}}</text>
          </view-->
        </view>
        <!--来源及匹配度-->
        <view class="shopping">
          <view class="shopping-summary">
            <!--view>
              <image class="shopping-icon" mode="aspectFit" src="http://www.shouxinjk.net/list/images/flags/{{item.distributor.country}}.png" wx:if="{{item.distributor.country.length>0}}"/>
            </view-->
              <image class="shopping-icon" class="shopping-icon" mode="aspectFit" src="http://www.shouxinjk.net/list/images/source/{{item.source}}.png" wx:if="{{item.source.length>0}}"/>
              <text class="box-title" wx:if="{{item.distributor.name.length>0}}">{{item.distributor.name}}</text>
              <!--text class="title" wx:if="{{item.seller.name.length>0}}">{{item.seller.name}}</text-->
          </view>
          <view class="likes">
            <!--text class="likes-number">{{countTotal}}</text-->
            <text class="currency" wx:if="{{item.price.currency}}">{{item.price.currency}}</text>
            <text class="currency" wx:if="{{item.price.currency==null}}">¥</text>
            <text class="price-sale" wx:if="{{item.price.sale}}">{{item.price.sale}}</text>
            <text class="price-bid" wx:if="{{item.price.bid}}">/</text>
            <text class="price-bid" wx:if="{{item.price.bid}}">{{item.price.bid}}</text>                                
          </view>      
        </view> 
        <view class="list-box">
          <!--标题与标签-->
          <view class="main-item">
            <!--title-->
            <view class="list-box-title">{{item.title}}</view>
            <!--tags-->
            <view class="tags" wx:if="{{item.tags.length>0}}">
              <navigator wx:for="{{item.tags}}" id="{{tag}}" wx:for-item="tag" wx:key="">
                  <view class="tag-text" wx:if="{{tag.length>0}}">#{{tag}}</view>
              </navigator>
            </view>
          </view>
          <!--相关指数-->
          <!--view class="similarity">
            <view class="similarity-title">相关度%</view>
            <view class="similarity-score">87.5</view>
          </view-->
        </view>
    </div>
</view>
*/

//将item显示到页面
function insertItem(){
    var item = items[num-1];//从本地取一条item

    var html = '';
    html += '<li><div class="WxMasonry">';
    html += '<div  id="item'+item._key+'">';
    html += htmlItemImage(item);
    html += htmlItemSummary(item);
    html += htmlItemTags(item);
    html += '</div>';
    html += '</div></li>';
    $("#waterfall").append(html);

    //注册事件
    $("#item'"+item._key+"']").click(function(){
        //跳转到详情页
        window.location.href = "detail.html?id="+item._key;
    });
    // 表示加载结束
    num++;
    loading = false;
}

function htmlItemImage(item){
    var html = '';
    html += '<div class="mainbody">';
    html += '<img class="WxMasonryImage" id="'+item._key+'" mode="aspectFill" src="'+item.images[0]+'" />';
    html += '</div>';
    return html;
}

function htmlItemSummary(item){
    var html = '';
    html += '<div class="shopping">';
    html += '<div class="shopping-summary">';
    if(item.source.length>0){
        html += '<img class="shopping-icon" class="shopping-icon" mode="aspectFit" src="http://www.shouxinjk.net/list/images/source/'+item.source+'.png"/>';
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
    html += '<div class="list-box-title">{{item.title}}</div>';
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

function changePerson (personId) {
    var ids = personId;
    if (app.globalData.isDebug) console.log("Feed::ChangePerson change person.[id]" + ids);
    $("#person"+currentPerson+" img").toggleClass("person-img");
    $("#person"+ids+" img").toggleClass("person-img-selected");
    $("#feeds").empty();//清空原有列表
    showloading(true);//显示加载状态

    page.current = -1;//从第一页开始查看
    currentPerson = ids;//修改当前用户
    items = [];//清空列表
    loadData();//重新加载数据
  },

