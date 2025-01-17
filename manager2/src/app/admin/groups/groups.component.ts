import { Component, OnInit, ViewChildren, QueryList } from '@angular/core';
import { GroupsService } from './groups.service';
import { ProjectsService } from 'src/app/admin/projects/projects.service';

import { Subject } from 'rxjs';
import { DataTableDirective } from 'angular-datatables';

@Component({
    selector: 'app-groups',
    templateUrl: './groups.component.html',
    styleUrls: ['./groups.component.css']
})
export class GroupsComponent implements OnInit {
    @ViewChildren(DataTableDirective)
    tables: QueryList<DataTableDirective>;

    dtTriggerGroups: Subject<any> = new Subject()
    dtTriggerUsers: Subject<any> = new Subject()

    success_msg: string
    err_msg: string
    rm_grp_msg_ok: string
    rm_grp_err_msg: string
    msg: string

    selectedGroup: any
    new_group: any

    projects: any[]
    groups: any[]
    users: any[]

    constructor(
        private groupsService: GroupsService,
        private projectsService: ProjectsService
    ) {
        this.selectedGroup = null;
        this.new_group = {
            name: '',
            owner: ''
        }
        this.projects = [];
        this.groups = [];
        this.users = [];
    }

    ngAfterViewInit(): void {
        // this.dtTriggerGroups.next();
        // this.dtTriggerUsers.next();
    }

    renderDataTables(table): void {
        if ($('#' + table).DataTable() !== undefined) {
            $('#' + table).DataTable().clear();
            $('#' + table).DataTable().destroy();
        }
        if (table == 'dtUsers') {
            this.dtTriggerUsers.next();
        } else {
            this.dtTriggerGroups.next();
        }
    }

    ngOnDestroy(): void {
        this.dtTriggerGroups.unsubscribe();
        this.dtTriggerUsers.unsubscribe();
    }

    ngOnInit() {
        this.groupsService.list().subscribe(
            resp => {
                this.groups = resp;
                this.renderDataTables('dtGroups');
                this.renderDataTables('dtUsers');
            },
            err => console.log('failed to get groups')
        )
    }

    addGroup(){
        if (this.new_group.name === '') {
            return;
        }
        this.err_msg = '';
        this.success_msg = '';
        this.groupsService.add(this.new_group).subscribe(
            resp => {
                this.success_msg = 'Group was created';
                this.groupsService.list().subscribe(
                    resp => {
                        this.groups = resp;
                        this.renderDataTables('dtGroups');
                    },
                    err => console.log('failed to get groups')
                )
            },
            err => {
                this.success_msg = '';
                this.err_msg = err.error;
            }
        )
    }

    delete_group(group){
        this.groupsService.delete(this.selectedGroup.name).subscribe(
            resp => {
                this.groupsService.list().subscribe(
                    resp => {
                        this.groups = resp;
                        this.renderDataTables('dtGroups');
                    },
                    err => console.log('failed to get groups')
                );
                this.selectedGroup = null;
            },
            err => {
                this.rm_grp_err_msg = err.error;
            }
        )
    }

    updateGroup(){
        this.groupsService.update(this.selectedGroup).subscribe(
            resp => {
                this.msg = 'Group updated';
                this.rm_grp_err_msg = '';
                this.groupsService.list().subscribe(
                    resp => {
                        this.groups = resp;
                        this.renderDataTables('dtGroups');
                    },
                    err => console.log('failed to get groups')
                )
            },
            err => {
                this.msg = '';
                this.rm_grp_err_msg = err.error;
            }
        )
    }

    show_group_users(group) {
        this.msg = '';
        this.rm_grp_err_msg = '';
        this.rm_grp_msg_ok = '';
        this.selectedGroup = group;
        this.projectsService.getProjectsInGroup(group.name).subscribe(
            resp => {
                this.projects = resp;
                this.groupsService.get(group.name).subscribe(
                    user_list => {
                        this.users = user_list;
                        for(var i = 0; i < user_list.length; i++){
                            var is_authorized = false;
                            if(user_list[i].projects){
                                for(var j = 0; j < this.projects.length; j++){
                                    if(user_list[i].projects.indexOf(this.projects[j].id) >= 0){
                                        is_authorized = true;
                                        break;
                                    }
                                }
                            }
                            this.users[i].authorized = is_authorized;
                        }
                        this.renderDataTables('dtUsers');
                    },
                    err => console.log('failed to get users in group', group)
                )
            },
            err => console.log('failed to get projects in group')
        )
    }

}
