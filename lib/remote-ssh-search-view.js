'use babel';

import { SelectListView } from 'atom-space-pen-views';

export default class RemoteSshSearchView {
	constructor(parent, primLine) {
		let _this = this;
		this.setPrimLine(primLine);
		this.parent = parent;
		this.element = document.createElement('div');
		this.element.classList.add('remote-ssh', 'remote-ssh-search-view');


		this.selectList = new SelectListView({
			placeholderText: 'Search',
			emptyMessage: 'No projects found',
			attributes: { 'class': 'remote-ssh-search-view-input' }
		});

		this.selectList.getFilterKey = function() {
			return 'search';
		};

		this.selectList.viewForItem = function(item) {
			let _prim = _this.primaryLine
					.replace(/\{projectname\}/ig, (typeof(item.projectName) === 'string' ? item.projectName : '{projectName}'))
					.replace(/\{\?projectname\}/ig, (typeof(item.projectName) === 'string' ? item.projectName : ''))
					.replace(/\{hostname\}/ig, (typeof(item.host) === 'string' ? item.host : '{hostName}'))
					.replace(/\{\?hostname\}/ig, (typeof(item.host) === 'string' ? item.host : ''))
					.replace(/\{foldername\}/ig, (typeof(item.folderName) === 'string' ? item.folderName : '{folderName}'))
					.replace(/\{\?foldername\}/ig, (typeof(item.folderName) === 'string' ? item.folderName : ''));

			return `
<li class="event two-lines">
	<div class="primary-line">${_prim}</div>
	<div class="secondary-line" style="display: flex">${item.tags.join(', ')}</div>
</li>`;
		};
		this.selectList.confirmed = function(item) {
			_this.parent.searchModal.hide();
			_this.parent.startSSH(item.config, item.projectName);
		};
		this.selectList.cancelled = function() {
			_this.parent.searchModal.hide();
		};
		this.element.appendChild(this.selectList.element);
	}

	setItems(items) {
		this.selectList.setItems(items);
	}

	setPrimLine(_newPrimLine) {
		if (typeof(_newPrimLine) !== 'string' || _newPrimLine.trim().length === 0) {
			this.primaryLine = "{projectName}<small class=\"pull-right\">{folderName}</small>";
		} else {
			this.primaryLine = _newPrimLine.trim();
		}
	}

	// Returns an object that can be retrieved when package is activated
	serialize() {
		return {
			data: this.data
		};
	}

	// Tear down any state and detach
	destroy() {
		this.element.remove();
	}

	getElement() {
		return this.element;
	}
}
