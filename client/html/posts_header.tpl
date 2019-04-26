<div class='post-list-header'><%
    %><form class='horizontal search'><%
        %><%= ctx.makeTextInput({text: 'Search query', id: 'search-text', name: 'search-text', value: ctx.parameters.query}) %><%
        %><wbr/><%
        %><input class='mousetrap' type='submit' value='Search'/><%
        %><button id='randomize-button' class='icon-button'><%
            %><i class="fa fa-random"><%
        %></button><%
        %><% if (ctx.enableSafety) { %><%
            %><input data-safety=safe type='button' class='mousetrap safety safety-safe <%- ctx.settings.listPosts.safe ? '' : 'disabled' %>'/><%
            %><input data-safety=sketchy type='button' class='mousetrap safety safety-sketchy <%- ctx.settings.listPosts.sketchy ? '' : 'disabled' %>'/><%
            %><input data-safety=unsafe type='button' class='mousetrap safety safety-unsafe <%- ctx.settings.listPosts.unsafe ? '' : 'disabled' %>'/><%
        %><% } %><%
        %><wbr/><%
        %><a class='mousetrap button append' href='<%- ctx.formatClientLink('help', 'search', 'posts') %>'>Syntax help</a><%
        %><wbr/><%
        %><span class="bulk-edit-btn-holder"><%
            %><a class='mousetrap button append open bulk-edit-btn'><%
                %>Mass edit<i class='fa fa-chevron-down icon-inline'></i><%
            %></a><%
            %><a class='mousetrap button append close bulk-edit-btn'><%
                %>Mass edit<i class='fa fa-chevron-up icon-inline'></i><%
            %></a><%
        %></span><%
    %></form><%
    %><div class='bulk-edit-block hidden'><%
        %><% if (ctx.canBulkEditTags) { %><%
            %><form class='horizontal bulk-edit bulk-edit-tags'><%
                %><span class='append hint'>Tagging with:</span><%
                %><a href class='mousetrap button append open'>Mass tag</a><%
                %><wbr/><%
                %><%= ctx.makeTextInput({name: 'tag', value: ctx.parameters.tag}) %><%
                %><input class='mousetrap start' type='submit' value='Start tagging'/><%
                %><a href class='mousetrap button append close'>Stop tagging</a><%
            %></form><%
        %><% } %><%
        %><% if (ctx.enableSafety && ctx.canBulkEditSafety) { %><%
            %><form class='horizontal bulk-edit bulk-edit-safety'><%
                %><a href class='mousetrap button append open'>Mass edit safety</a><%
                %><a href class='mousetrap button append close'>Stop editing safety</a><%
            %></form><%
        %><% } %><%
        %><!--TODO: create permission--><%
        %><form class='horizontal bulk-edit bulk-add-relation'><%
            %><a href class='mousetrap button append open'>Mass add relation</a><%
            %><a href class='mousetrap button append close'>Stop adding relation</a><%
        %></form><%
    %></div><%
%></div>
