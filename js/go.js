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
    var id = args["id"]?args["id"]:0;

    from = args["from"]?args["from"]:"mp";//可能为groupmessage,timeline等
    fromUser = args["fromUser"]?args["fromUser"]:"";//从连接中获取分享用户ID
    fromBroker = args["fromBroker"]?args["fromBroker"]:"";//从连接中获取分享达人ID。重要：将依据此进行收益计算

    //如果未指定fromBroker，则检查首次触达达人
    if(!fromBroker || fromBroker=="" || fromBroker.trim().length==0){
        fromBroker = util.getInitBroker();
    }

    //由于本页是中间页，将直接跳转到第三方商品详情页面，在返回时，需要能够退回到上一个页面。
    //通过document.referrer处理
    if($.cookie('sxJumpUrl') && $.cookie('sxJumpUrl').trim().length>0){//如果是从第三方页面返回，则会记录有cookie，根据cookie记录返回
        var toUrl = $.cookie('sxJumpUrl');
        $.cookie('sxJumpUrl', '', { expires: 1, path: '/' });//清除原记录
        window.location.href=toUrl;
    }else{//否则认为是通过扫码或链接点击进入当前页面，记录前序页面url到cookie
        //获取前一页URL
        var fromUrl = "index.html";//默认为首页
        if(document.referrer && document.referrer!=''){
            fromUrl = document.referrer;
        }        
        //写入cookie
        var expDate = new Date();
        expDate.setTime(expDate.getTime()+60*1000);//设置1分钟失效，假设用户最多在1分钟内会返回。否则将直接返回到首页
        $.cookie('sxJumpUrl', fromUrl, { expires: expDate, path: '/' });//记录返回时要跳转的链接 
        jump(id);
    }

    //检查cookie中是否有临时跳转信息，如果是从index直接跳转将存储该标志，返回时直接跳到index
    /**
    if($.cookie('sxJump') && $.cookie('sxJump').trim().length>0 && $.cookie('sxJump').trim()=="true"){//表示是从首页跳转，直接返回首页
        $.cookie('sxJump', '', { expires: 1, path: '/' });//清除临时跳转记录
        window.location.href="index.html";
    }else{
        var expDate = new Date();
        expDate.setTime(expDate.getTime()+60*1000);//设置1分钟失效，避免错误
        $.cookie('sxJump', 'true', { expires: expDate, path: '/' });//记录临时跳转
        jump(id);
    }
    //**/
});

//解决返回时不重新加载问题
window.onpageshow = function (event) {
    if (event.persisted) {
        window.location.reload()
    }
} 

//记录分享用户、分享达人
var from = "mp";//链接来源，默认为公众号进入
var fromUser = "";
var fromBroker = "";

function jump(id){//获取详细内容
    $.ajax({
        url:"https://data.shouxinjk.net/_db/sea/my/stuff/"+id,
        type:"get",
        data:{},
        success:function(item){
            //先记录日志
            logstash(item,from,"buy step2",fromUser,fromBroker,function(){});
            //获取达人链接并跳转
            if(item.link.cps && item.link.cps[fromBroker] ){//能够直接获得达人链接则直接显示
                window.location.href = item.link.cps[fromBroker];
            }else{//否则请求其链接并显示
                getBrokerCpsLink(fromBroker,item);
            }            
        }
    })            
}


//根据Broker查询得到CPS链接
function getBrokerCpsLink(brokerId,item) {
    var data={
        brokerId:brokerId,
        source:item.source,
        category:"",//注意：不按照类别进行区分
        //category:item.categoryId?item.categoryId:"",
        url:item.link.wap
    };
    console.log("try to generate broker specified url",data);
    util.AJAX(app.config.sx_api+"/mod/cpsLinkScheme/rest/cpslink", function (res) {
        console.log("======\nload cps link info.",data,res);
        if (res.status) {//用返回的cps链接
            //更新到item，更新完成后跳转到cps链接地址
            //updateBrokerCpsLink(item,brokerId,res.link);
            //直接跳转            
            window.location.href = res.link;
        }else{//如果不能生成链接则直接使用已有链接
            if(item.link.wap2){
                window.location.href = item.link.wap2;
            }else if(item.link.wap){
                window.location.href = item.link.wap;
            }else{//理论上不会到这里
                window.location.href = item.url;
            }
        }
    },"GET",data);
}

//更新item信息：补充达人CPS链接
function updateBrokerCpsLink(item,brokerId,cpsLink) {
    var header={
        "Content-Type":"application/json",
        Authorization:"Basic aWxpZmU6aWxpZmU="
    };   
    var cps = {};
    cps[brokerId]=cpsLink;//yibrokerId为key，以cpslink为value
    var data = {link:{cps:cps}};
    var url = app.config.data_api +"/_api/document/my_stuff/"+item._key;
    if (app.globalData.isDebug) console.log("Info2::updateItem update item with broker cps link.[itemKey]"+item._key,data);
    $.ajax({
        url:url,
        type:"PATCH",
        data:JSON.stringify(data),//注意：nginx启用CORS配置后不能直接通过JSON对象传值
        headers:header,
        timeout:2000,//设置超时
        success:function(res){//正确返回则跳转到返回地址
          if (app.globalData.isDebug) console.log("Info2::updateItem update item finished.", res);
          //跳转到cps地址
          window.location.href = cpsLink;
        },
        complete: function (XMLHttpRequest, textStatus) {//调用执行后调用的函数
            if(textStatus == 'timeout'){//如果是超时，则直接跳转到cps地址，忽略更新stuff失败
              console.log("ajax timeout. jump to cps link directly.",textStatus);
              window.location.href = cpsLink;
            }
        },
        error: function () {//调用出错执行的函数
            console.log("error occured while update cps link to stuff. jump to cps link directly.");
            window.location.href = cpsLink;
          }

    });
}
