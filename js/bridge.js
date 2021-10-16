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
    var args = getQuery();//获取参数：其中url为必传参数

    jump(decodeURIComponent(args["url"]));
});

function jump(url){//直接跳转
    window.location.href = url;          
}

